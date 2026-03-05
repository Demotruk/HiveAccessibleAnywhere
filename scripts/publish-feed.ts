import 'dotenv/config';

/**
 * Endpoint Feed Publisher
 *
 * Sends encrypted endpoint memos to subscribed users.
 * Each user receives a transfer (0.001 HBD) with an encrypted memo
 * containing their assigned RPC proxy endpoints.
 *
 * Usage:
 *   npx tsx publish-feed.ts [--dry-run] [--config feed-config.json]
 *
 * Environment variables:
 *   HAA_SERVICE_ACCOUNT   - Hive account name of the service operator
 *   HAA_ACTIVE_KEY        - Private active key (WIF) for sending transfers
 *   HAA_MEMO_KEY          - Private memo key (WIF) for encrypting memos
 *
 * Config file format (feed-config.json):
 *   {
 *     "endpoints": ["https://proxy1.example.com/rpc"],
 *     "expires": "2026-06-01T00:00:00Z",
 *     "subscribers": ["user1", "user2"],
 *     "groups": {
 *       "group-a": {
 *         "endpoints": ["https://proxy-a.example.com/rpc"],
 *         "subscribers": ["user3", "user4"]
 *       }
 *     }
 *   }
 *
 * Subscribers not in a group receive the top-level endpoints.
 * Groups allow different users to get different endpoints for leak tracing.
 */

import { Transaction, Memo, config as hiveTxConfig, PrivateKey } from 'hive-tx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// -- Types --

interface EndpointPayload {
  v: number;
  endpoints: string[];
  expires: string;
}

interface FeedGroup {
  endpoints: string[];
  subscribers: string[];
}

interface FeedConfig {
  endpoints: string[];
  expires: string;
  subscribers: string[];
  groups?: Record<string, FeedGroup>;
}

interface SubscriberAssignment {
  account: string;
  payload: EndpointPayload;
}

// -- Parse args --

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const configIdx = args.indexOf('--config');
const configPath = configIdx >= 0 ? args[configIdx + 1] : 'feed-config.json';

// -- Load environment --

const SERVICE_ACCOUNT = process.env.HAA_SERVICE_ACCOUNT;
const ACTIVE_KEY = process.env.HAA_ACTIVE_KEY;
const MEMO_KEY = process.env.HAA_MEMO_KEY;

if (!SERVICE_ACCOUNT || !ACTIVE_KEY || !MEMO_KEY) {
  console.error('Missing environment variables.');
  console.error('Required: HAA_SERVICE_ACCOUNT, HAA_ACTIVE_KEY, HAA_MEMO_KEY');
  process.exit(1);
}

// -- Load config --

let config: FeedConfig;
try {
  const raw = readFileSync(resolve(configPath), 'utf-8');
  config = JSON.parse(raw) as FeedConfig;
} catch (e) {
  console.error(`Failed to read config from ${configPath}:`, (e as Error).message);
  console.error('Create a feed-config.json or specify --config <path>');
  process.exit(1);
}

// -- Build subscriber assignments --

function buildAssignments(config: FeedConfig): SubscriberAssignment[] {
  const assignments: SubscriberAssignment[] = [];
  const grouped = new Set<string>();

  // Group-specific assignments
  if (config.groups) {
    for (const [groupName, group] of Object.entries(config.groups)) {
      console.log(`Group "${groupName}": ${group.subscribers.length} subscribers, ${group.endpoints.length} endpoints`);
      for (const account of group.subscribers) {
        assignments.push({
          account,
          payload: {
            v: 1,
            endpoints: group.endpoints,
            expires: config.expires,
          },
        });
        grouped.add(account);
      }
    }
  }

  // Default assignments (subscribers not in any group)
  for (const account of config.subscribers) {
    if (!grouped.has(account)) {
      assignments.push({
        account,
        payload: {
          v: 1,
          endpoints: config.endpoints,
          expires: config.expires,
        },
      });
    }
  }

  return assignments;
}

// -- Look up public memo keys --

async function getPublicMemoKeys(accounts: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  // Batch in groups of 50
  for (let i = 0; i < accounts.length; i += 50) {
    const batch = accounts.slice(i, i + 50);
    const response = await fetch(hiveTxConfig.nodes[0], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'condenser_api.get_accounts',
        params: [batch],
        id: 1,
      }),
    });
    const data = await response.json() as any;
    if (data.result) {
      for (const acc of data.result) {
        result.set(acc.name, acc.memo_key);
      }
    }
  }
  return result;
}

// -- Send encrypted memo transfer --

async function sendMemoTransfer(
  to: string,
  encryptedMemo: string,
  activeKeyWif: string,
): Promise<{ tx_id: string; status: string }> {
  const tx = new Transaction();
  await tx.addOperation('transfer' as any, {
    from: SERVICE_ACCOUNT,
    to,
    amount: '0.001 HBD',
    memo: encryptedMemo,
  } as any);

  const key = PrivateKey.from(activeKeyWif);
  tx.sign(key);
  const result = await tx.broadcast(true);
  return result;
}

// -- Main --

async function main() {
  console.log('=== HAA Endpoint Feed Publisher ===');
  console.log(`Service account: @${SERVICE_ACCOUNT}`);
  console.log(`Config: ${configPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Configure hive-tx
  hiveTxConfig.nodes = ['https://api.hive.blog'];

  const assignments = buildAssignments(config);
  console.log(`Total subscribers: ${assignments.length}`);
  console.log('');

  // Look up public memo keys
  const accounts = assignments.map(a => a.account);
  console.log('Looking up public memo keys...');
  const memoKeys = await getPublicMemoKeys(accounts);

  // Check for missing accounts
  const missing = accounts.filter(a => !memoKeys.has(a));
  if (missing.length > 0) {
    console.warn(`WARNING: ${missing.length} accounts not found: ${missing.join(', ')}`);
  }

  // Process each subscriber
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const assignment of assignments) {
    const { account, payload } = assignment;
    const publicMemoKey = memoKeys.get(account);

    if (!publicMemoKey) {
      console.log(`  SKIP @${account} — account not found`);
      skipped++;
      continue;
    }

    const payloadJson = JSON.stringify(payload);
    console.log(`  @${account} — ${payload.endpoints.length} endpoint(s), expires ${payload.expires}`);

    if (dryRun) {
      console.log(`    [DRY RUN] Would encrypt and send: ${payloadJson}`);
      sent++;
      continue;
    }

    try {
      // Encrypt the memo
      const encrypted = Memo.encode(MEMO_KEY!, publicMemoKey, `#${payloadJson}`);

      // Send the transfer with encrypted memo
      const result = await sendMemoTransfer(account, encrypted, ACTIVE_KEY!);
      console.log(`    Sent! TX: ${result.tx_id?.slice(0, 12)}... (${result.status})`);
      sent++;

      // Small delay between transfers to avoid rate limiting
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error(`    FAILED: ${(e as Error).message}`);
      failed++;
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);

  if (dryRun) {
    console.log('');
    console.log('This was a dry run. No transactions were broadcast.');
    console.log('Remove --dry-run to send for real.');
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
