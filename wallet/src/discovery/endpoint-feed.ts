/**
 * Endpoint discovery via encrypted Hive memos.
 *
 * Scans the user's account history for transfers from a service account,
 * decrypts the memo using the user's private memo key, and parses the
 * endpoint payload.
 */

import { getClient } from '../hive/client';
import { decryptMemo } from '../hive/memo';

/** The expected payload inside a decrypted endpoint memo */
export interface EndpointPayload {
  /** Protocol version */
  v: number;
  /** List of RPC proxy endpoint URLs */
  endpoints: string[];
  /** ISO 8601 expiry timestamp */
  expires: string;
}

/** A discovered endpoint feed entry with metadata */
export interface FeedEntry {
  payload: EndpointPayload;
  /** Hive block timestamp when the memo was sent */
  timestamp: string;
  /** Transaction ID */
  trxId: string;
  /** Sender account (service account) */
  from: string;
}

/** Default service accounts to look for endpoint memos from */
const DEFAULT_SERVICE_ACCOUNTS = ['haa-service'];

/**
 * Scan account history for endpoint feed memos.
 *
 * Looks for transfer operations from known service accounts with
 * encrypted memos, decrypts them, and returns valid endpoint payloads
 * sorted newest-first.
 *
 * @param account - The user's Hive account name
 * @param memoKeyWif - The user's private memo key in WIF format
 * @param serviceAccounts - List of service account names to accept memos from
 * @param limit - Max history entries to scan (default 500)
 */
export async function discoverEndpoints(
  account: string,
  memoKeyWif: string,
  serviceAccounts: string[] = DEFAULT_SERVICE_ACCOUNTS,
  limit = 500,
): Promise<FeedEntry[]> {
  const client = getClient();
  const entries: FeedEntry[] = [];
  const serviceSet = new Set(serviceAccounts.map(a => a.toLowerCase()));

  // Fetch recent account history
  // condenser_api.get_account_history returns [index, operation] pairs
  // start=-1 means "most recent", limit=N fetches up to N entries
  const batchSize = Math.min(limit, 1000);
  const history = await client.getAccountHistory(account, -1, batchSize);

  for (const [_idx, entry] of history) {
    const [opType, opBody] = entry.op;

    // Only look at transfer operations
    if (opType !== 'transfer') continue;

    const { from, to, memo } = opBody as {
      from: string;
      to: string;
      memo: string;
    };

    // Must be sent TO this user, FROM a known service account
    if (to.toLowerCase() !== account.toLowerCase()) continue;
    if (!serviceSet.has(from.toLowerCase())) continue;

    // Must have an encrypted memo (starts with '#')
    if (!memo || !memo.startsWith('#')) continue;

    try {
      const decrypted = decryptMemo(memo, memoKeyWif);
      const payload = JSON.parse(decrypted) as EndpointPayload;

      // Validate payload structure
      if (!isValidPayload(payload)) continue;

      // Skip expired entries
      if (new Date(payload.expires) < new Date()) continue;

      entries.push({
        payload,
        timestamp: entry.timestamp as string,
        trxId: entry.trx_id as string,
        from,
      });
    } catch {
      // Decryption or parsing failed — skip this memo
      continue;
    }
  }

  // Sort newest first (by timestamp)
  entries.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return entries;
}

/**
 * Get the latest valid endpoint list from the feed.
 * Returns the endpoints from the most recent non-expired memo,
 * or null if no valid endpoints are found.
 */
export async function getLatestEndpoints(
  account: string,
  memoKeyWif: string,
  serviceAccounts?: string[],
): Promise<EndpointPayload | null> {
  const entries = await discoverEndpoints(account, memoKeyWif, serviceAccounts);
  return entries.length > 0 ? entries[0].payload : null;
}

/** Type guard for EndpointPayload */
export function isValidPayload(obj: unknown): obj is EndpointPayload {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.v === 'number' &&
    Array.isArray(p.endpoints) &&
    p.endpoints.length > 0 &&
    p.endpoints.every((e: unknown) => typeof e === 'string') &&
    typeof p.expires === 'string'
  );
}
