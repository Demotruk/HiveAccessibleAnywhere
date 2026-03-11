/**
 * On-chain batch declaration lookup.
 *
 * Fetches gift card batch declarations from the provider's Hive account
 * history by scanning for custom_json operations with the
 * 'propolis_giftcard_batch' ID.
 *
 * Scans from newest to oldest and stops early once the target batch is
 * found. A full scan is only performed on explicit warm-up or when a
 * batch isn't found in recent history.
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
let scanHighWaterMark = -1; // lowest history index we've scanned so far

/**
 * Clear the in-memory cache. Mainly useful for testing.
 */
export function clearBatchCache(): void {
  cache.clear();
  scanHighWaterMark = -1;
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
 * Extract batch declarations from a page of account history entries.
 * Returns the number of new batches found.
 */
function extractBatches(
  history: [number, AccountHistoryOp][],
  providerAccount: string,
): number {
  let found = 0;
  for (const [, entry] of history) {
    const [opType, opData] = entry.op;

    if (opType !== 'custom_json') continue;
    if (opData.id !== 'propolis_giftcard_batch') continue;

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
        found++;
      }
    } catch {
      // Malformed JSON — skip
    }
  }
  return found;
}

/**
 * Scan the provider's account history for batch declarations.
 *
 * Walks backwards from the most recent entry. If `targetBatchId` is
 * provided, stops as soon as that batch is found (fast path for claims).
 * If `maxPages` is provided, limits the scan depth.
 *
 * Updates `scanHighWaterMark` to track how far back we've scanned,
 * so subsequent calls can resume from where the last scan stopped.
 */
async function scanAccountHistory(
  providerAccount: string,
  hiveNodes: string[],
  targetBatchId?: string,
  maxPages?: number,
): Promise<void> {
  const PAGE_SIZE = 1000;
  let start = scanHighWaterMark > 0 ? scanHighWaterMark - 1 : -1;
  let lastError: Error | null = null;
  let pages = 0;

  // If we've already scanned some history, start from where we left off.
  // But if start is already 0, there's nothing left to scan.
  if (start === 0) return;

  while (true) {
    const limit = start === -1 ? PAGE_SIZE : Math.min(PAGE_SIZE, start + 1);

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

    pages++;
    extractBatches(history, providerAccount);

    // Track how far back we've scanned
    const earliest = history[0][0];
    if (scanHighWaterMark < 0 || earliest < scanHighWaterMark) {
      scanHighWaterMark = earliest;
    }

    // Early exit: found the target batch
    if (targetBatchId && cache.has(targetBatchId)) {
      console.log(`[BATCH] Found target batch ${targetBatchId} after ${pages} page(s)`);
      return;
    }

    // Page limit reached
    if (maxPages && pages >= maxPages) {
      console.log(`[BATCH] Reached max pages (${maxPages}), scanned down to index ${earliest}`);
      return;
    }

    // Reached the beginning of history
    if (history.length < limit) break;
    if (earliest <= 0) break;
    start = earliest - 1;
  }

  console.log(`[BATCH] Full scan complete: ${pages} page(s), ${cache.size} batch(es) cached`);
}

// -- Public API --

/**
 * Fetch a batch declaration by ID.
 *
 * 1. Check the in-memory cache.
 * 2. Scan recent history (up to 10 pages / 10k entries) looking for the
 *    specific batch — enough to cover any recently-published batches.
 * 3. If still not found, do a full scan of all remaining history.
 *
 * Returns null if the batch was not found after a complete scan.
 */
export async function fetchBatchDeclaration(
  providerAccount: string,
  batchId: string,
  hiveNodes: string[],
): Promise<BatchDeclaration | null> {
  // Check cache first
  const cached = cache.get(batchId);
  if (cached) return cached;

  // Quick scan of recent history (batch declarations are typically recent)
  await scanAccountHistory(providerAccount, hiveNodes, batchId, 10);
  const found = cache.get(batchId);
  if (found) return found;

  // Full scan of remaining history (continues from where quick scan stopped)
  await scanAccountHistory(providerAccount, hiveNodes, batchId);
  return cache.get(batchId) ?? null;
}

/**
 * Pre-warm the cache by scanning recent account history.
 * Scans up to `maxPages` pages (default 10 = ~10k entries) to cache
 * any batch declarations found in recent history. Does not do a full
 * scan — this is meant to be fast at startup.
 */
export async function warmBatchCache(
  providerAccount: string,
  hiveNodes: string[],
  maxPages = 10,
): Promise<void> {
  await scanAccountHistory(providerAccount, hiveNodes, undefined, maxPages);
}
