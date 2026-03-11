/**
 * On-chain batch declaration lookup.
 *
 * Fetches gift card batch declarations from the provider's Hive account
 * history by scanning for custom_json operations with the
 * 'propolis_giftcard_batch' ID.
 *
 * Results are cached in memory — batch declarations are immutable once
 * published on-chain, so cache entries never expire.
 */

// -- Types --

export interface BatchDeclaration {
  batchId: string;
  count: number;
  expires: string;
  merkleRoot: string;
  promiseType: string;
  promiseParams?: Record<string, unknown>;
  txId: string;
}

interface AccountHistoryOp {
  op: [string, Record<string, unknown>];
  trx_id: string;
  [key: string]: unknown;
}

// -- Cache --

const cache = new Map<string, BatchDeclaration>();
let fullScanDone = false;

/**
 * Clear the in-memory cache. Mainly useful for testing.
 */
export function clearBatchCache(): void {
  cache.clear();
  fullScanDone = false;
}

// -- Helpers --

async function rpcCall<T>(
  node: string,
  method: string,
  params: unknown[],
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  const response = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    signal: ctrl.signal,
  });
  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as { result?: T; error?: { message: string } };
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }
  return data.result as T;
}

/**
 * Scan the provider's account history for batch declarations and populate
 * the cache. Uses pagination to walk backwards through history.
 */
async function scanAccountHistory(
  providerAccount: string,
  hiveNodes: string[],
): Promise<void> {
  const PAGE_SIZE = 1000;
  let start = -1;
  let lastError: Error | null = null;

  // Walk backwards through account history
  while (true) {
    // Hive API requires start >= limit - 1 (when start != -1).
    // Cap limit so we don't overshoot on small accounts or final pages.
    const limit = start === -1 ? PAGE_SIZE : Math.min(PAGE_SIZE, start + 1);

    // Try each node in order until one succeeds
    let history: [number, AccountHistoryOp][] | null = null;
    for (const node of hiveNodes) {
      try {
        const t0 = Date.now();
        history = await rpcCall<[number, AccountHistoryOp][]>(
          node,
          'condenser_api.get_account_history',
          [providerAccount, start, limit],
        );
        console.log(`[BATCH] get_account_history(start=${start}, limit=${limit}) from ${node} → ${history?.length ?? 0} entries (${Date.now() - t0}ms)`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[BATCH] get_account_history(start=${start}) from ${node} FAILED: ${lastError.message}`);
      }
    }

    if (!history || history.length === 0) {
      if (!history && lastError) throw lastError;
      break;
    }

    for (const [, entry] of history) {
      const [opType, opData] = entry.op;

      if (opType !== 'custom_json') continue;
      if (opData.id !== 'propolis_giftcard_batch') continue;

      // Verify the declaration was signed by the provider's active key
      const requiredAuths = opData.required_auths as string[] | undefined;
      if (!requiredAuths || !requiredAuths.includes(providerAccount)) continue;

      try {
        const json = JSON.parse(opData.json as string) as Record<string, unknown>;
        const batchId = json.batch_id as string;

        if (batchId && !cache.has(batchId)) {
          cache.set(batchId, {
            batchId,
            count: json.count as number,
            expires: json.expires as string,
            merkleRoot: json.merkle_root as string,
            promiseType: (json.promise_type as string) || 'account-creation',
            promiseParams: json.promise_params as Record<string, unknown> | undefined,
            txId: entry.trx_id,
          });
        }
      } catch {
        // Malformed JSON — skip
      }
    }

    // If we got fewer entries than requested, we've reached the beginning
    if (history.length < limit) break;

    // Move the cursor backward (earliest entry index minus 1)
    const earliest = history[0][0];
    if (earliest <= 0) break;
    start = earliest - 1;
  }

  fullScanDone = true;
}

// -- Public API --

/**
 * Fetch a batch declaration by ID.
 *
 * First checks the in-memory cache. If not cached, scans the provider's
 * account history on-chain and caches all found declarations.
 *
 * Returns null if the batch was not found after a full scan.
 */
export async function fetchBatchDeclaration(
  providerAccount: string,
  batchId: string,
  hiveNodes: string[],
): Promise<BatchDeclaration | null> {
  // Check cache first
  const cached = cache.get(batchId);
  if (cached) return cached;

  // If we've already done a full scan and didn't find it, it's not there
  if (fullScanDone) return null;

  // Scan account history (populates cache for all found batches)
  await scanAccountHistory(providerAccount, hiveNodes);

  return cache.get(batchId) ?? null;
}
