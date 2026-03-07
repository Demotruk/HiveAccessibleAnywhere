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
 *   npx tsx publish-feed.ts --auto-discover [--recency-days 30] [--dry-run]
 *   npx tsx publish-feed.ts --auto-discover --config feed-config.json [--dry-run]
 *
 * Flags:
 *   --dry-run           Show what would happen without sending transactions
 *   --config <path>     Path to feed-config.json (default: feed-config.json)
 *   --auto-discover     Discover subscribers from incoming transfers to haa-service
 *   --recency-days <N>  Only discover subscribers from the last N days (default: 30)
 *   --endpoints <urls>  Comma-separated endpoint URLs (alternative to config file)
 *   --expires <date>    ISO 8601 expiry date (default: 90 days from now)
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
 *
 * Self-subscription: Users send any transfer to haa-service to subscribe.
 * Use --auto-discover to scan for these subscribers automatically.
 * Subscriptions auto-expire after --recency-days (default 30).
 */

import { Transaction, Memo, config as hiveTxConfig, PrivateKey } from 'hive-tx';
import { readFileSync, existsSync } from 'node:fs';
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
  subscribers?: string[];
  groups?: Record<string, FeedGroup>;
}

interface SubscriberAssignment {
  account: string;
  payload: EndpointPayload;
}

// -- Parse args --

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const autoDiscover = args.includes('--auto-discover');
const configIdx = args.indexOf('--config');
const configPath = configIdx >= 0 ? args[configIdx + 1] : 'feed-config.json';

const recencyIdx = args.indexOf('--recency-days');
const recencyDays = recencyIdx >= 0 ? parseInt(args[recencyIdx + 1], 10) : 30;

const endpointsIdx = args.indexOf('--endpoints');
const cliEndpoints = endpointsIdx >= 0 ? args[endpointsIdx + 1].split(',').map(s => s.trim()) : null;

const expiresIdx = args.indexOf('--expires');
const cliExpires = expiresIdx >= 0 ? args[expiresIdx + 1] : null;

// -- Load environment --

const SERVICE_ACCOUNT = process.env.HAA_SERVICE_ACCOUNT;
const ACTIVE_KEY = process.env.HAA_ACTIVE_KEY;
const MEMO_KEY = process.env.HAA_MEMO_KEY;

if (!SERVICE_ACCOUNT || !ACTIVE_KEY || !MEMO_KEY) {
  console.error('Missing environment variables.');
  console.error('Required: HAA_SERVICE_ACCOUNT, HAA_ACTIVE_KEY, HAA_MEMO_KEY');
  process.exit(1);
}

// -- Load config (optional when using --auto-discover with --endpoints) --

let config: FeedConfig | null = null;

const configFullPath = resolve(configPath);
if (existsSync(configFullPath)) {
  try {
    const raw = readFileSync(configFullPath, 'utf-8');
    config = JSON.parse(raw) as FeedConfig;
  } catch (e) {
    console.error(`Failed to parse config from ${configPath}:`, (e as Error).message);
    process.exit(1);
  }
} else if (!autoDiscover) {
  console.error(`Config file not found: ${configPath}`);
  console.error('Create a feed-config.json, specify --config <path>, or use --auto-discover');
  process.exit(1);
}

// Resolve endpoints and expires from config or CLI flags
const endpoints = cliEndpoints ?? config?.endpoints ?? null;
const expires = cliExpires ?? config?.expires ?? new Date(Date.now() + 90 * 86400_000).toISOString();

if (!endpoints || endpoints.length === 0) {
  console.error('No endpoints specified. Use --endpoints <urls> or provide them in the config file.');
  process.exit(1);
}

// -- Discover subscribers from incoming transfers --

async function discoverSubscribers(
  serviceAccount: string,
  recencyDays: number,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - recencyDays * 86400_000);
  const subscribers = new Map<string, string>(); // account -> most recent timestamp

  console.log(`Scanning @${serviceAccount} history for incoming transfers (last ${recencyDays} days)...`);

  let start = -1;
  const batchSize = 1000;
  let done = false;

  while (!done) {
    const response = await fetch(hiveTxConfig.nodes[0], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'condenser_api.get_account_history',
        params: [serviceAccount, start, batchSize],
        id: 1,
      }),
    });
    const data = await response.json() as any;
    const history: any[] = data.result ?? [];

    if (history.length === 0) break;

    for (const [idx, entry] of history) {
      const [opType, opBody] = entry.op;
      if (opType !== 'transfer') continue;

      const { from, to } = opBody as { from: string; to: string };

      // Must be a transfer TO the service account
      if (to.toLowerCase() !== serviceAccount.toLowerCase()) continue;

      // Check recency
      const timestamp = new Date(entry.timestamp + 'Z');
      if (timestamp < cutoff) {
        // History is not strictly ordered, but once we're past cutoff in older entries we can stop paginating
        continue;
      }

      // Record the subscriber (deduplicate, keep most recent)
      const account = from.toLowerCase();
      if (!subscribers.has(account) || timestamp.toISOString() > subscribers.get(account)!) {
        subscribers.set(account, timestamp.toISOString());
      }
    }

    // Paginate backwards: use the smallest index in this batch
    const oldestIdx = history[0][0];
    if (oldestIdx <= 0 || history.length < batchSize) {
      done = true;
    } else {
      // Check if the oldest entry is already past cutoff
      const oldestEntry = history[0][1];
      const oldestTime = new Date(oldestEntry.timestamp + 'Z');
      if (oldestTime < cutoff) {
        done = true;
      } else {
        start = oldestIdx - 1;
      }
    }
  }

  // Sort by most recent first
  const sorted = [...subscribers.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([account]) => account);

  return sorted;
}

// -- Build subscriber assignments --

function buildAssignments(
  config: FeedConfig | null,
  discoveredSubscribers: string[],
  defaultEndpoints: string[],
  defaultExpires: string,
): SubscriberAssignment[] {
  const assignments: SubscriberAssignment[] = [];
  const assigned = new Set<string>();

  // Group-specific assignments from config
  if (config?.groups) {
    for (const [groupName, group] of Object.entries(config.groups)) {
      console.log(`Group "${groupName}": ${group.subscribers.length} subscribers, ${group.endpoints.length} endpoints`);
      for (const account of group.subscribers) {
        const key = account.toLowerCase();
        assignments.push({
          account,
          payload: {
            v: 1,
            endpoints: group.endpoints,
            expires: defaultExpires,
          },
        });
        assigned.add(key);
      }
    }
  }

  // Manual subscribers from config (not in any group)
  const manualSubscribers = config?.subscribers ?? [];
  for (const account of manualSubscribers) {
    const key = account.toLowerCase();
    if (!assigned.has(key)) {
      assignments.push({
        account,
        payload: {
          v: 1,
          endpoints: defaultEndpoints,
          expires: defaultExpires,
        },
      });
      assigned.add(key);
    }
  }

  // Auto-discovered subscribers (not already assigned via config)
  let discoveredCount = 0;
  for (const account of discoveredSubscribers) {
    const key = account.toLowerCase();
    if (!assigned.has(key)) {
      assignments.push({
        account,
        payload: {
          v: 1,
          endpoints: defaultEndpoints,
          expires: defaultExpires,
        },
      });
      assigned.add(key);
      discoveredCount++;
    }
  }

  if (discoveredSubscribers.length > 0) {
    const skippedDupes = discoveredSubscribers.length - discoveredCount;
    console.log(`Discovered: ${discoveredSubscribers.length} subscriber(s), ${discoveredCount} new, ${skippedDupes} already in config`);
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
  if (config) console.log(`Config: ${configPath}`);
  if (autoDiscover) console.log(`Auto-discover: ON (last ${recencyDays} days)`);
  console.log(`Endpoints: ${endpoints!.join(', ')}`);
  console.log(`Expires: ${expires}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Configure hive-tx
  hiveTxConfig.nodes = ['https://api.hive.blog'];

  // Discover subscribers if enabled
  let discovered: string[] = [];
  if (autoDiscover) {
    discovered = await discoverSubscribers(SERVICE_ACCOUNT!, recencyDays);
    if (discovered.length === 0) {
      console.log('No subscribers discovered from incoming transfers.');
    } else {
      console.log(`Found ${discovered.length} subscriber(s): ${discovered.join(', ')}`);
    }
    console.log('');
  }

  const assignments = buildAssignments(config, discovered, endpoints!, expires);
  console.log(`Total subscribers: ${assignments.length}`);

  if (assignments.length === 0) {
    console.log('Nothing to do.');
    return;
  }
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
