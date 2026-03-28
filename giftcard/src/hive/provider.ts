/**
 * Provider resolution for multi-tenant mode.
 *
 * Fetches a provider's account data from the Hive blockchain to obtain
 * their memo public key (for signature verification) and confirm the
 * account exists. Results are cached in memory with a 1-hour TTL since
 * memo keys rarely change.
 *
 * In single-tenant mode this module is not used — the memo key comes
 * from the config's GIFTCARD_MEMO_KEY environment variable.
 */

import type { GiftcardConfig } from '../config.js';

// -- Types --

export interface ResolvedProvider {
  /** Provider's Hive account name */
  account: string;
  /** Provider's memo public key (STM... format) for signature verification */
  memoPublicKey: string;
}

// -- Cache --

interface CacheEntry {
  provider: ResolvedProvider;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

/**
 * Clear the provider cache. Mainly useful for testing.
 */
export function clearProviderCache(): void {
  cache.clear();
}

// -- Resolution --

/**
 * Resolve a provider's account info from the Hive blockchain.
 *
 * Fetches the account via `condenser_api.get_accounts` and extracts
 * the memo public key. Tries multiple nodes with a 10-second timeout
 * per attempt.
 *
 * Results are cached for 1 hour.
 *
 * @throws Error if the account doesn't exist or all nodes fail
 */
export async function resolveProvider(
  providerAccount: string,
  hiveNodes: string[],
): Promise<ResolvedProvider> {
  // Check cache
  const cached = cache.get(providerAccount);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.provider;
  }

  // Fetch from chain
  let lastError: Error | null = null;
  for (const node of hiveNodes) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const response = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_accounts',
          params: [[providerAccount]],
          id: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as {
        result?: Array<{ memo_key?: string; name?: string }>;
        error?: { message: string };
      };
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      const account = data.result?.[0];
      if (!account) {
        throw new Error(`Account @${providerAccount} not found on chain`);
      }

      const memoPublicKey = account.memo_key;
      if (!memoPublicKey) {
        throw new Error(`Account @${providerAccount} has no memo key`);
      }

      const resolved: ResolvedProvider = {
        account: providerAccount,
        memoPublicKey,
      };

      // Cache the result
      cache.set(providerAccount, {
        provider: resolved,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      console.log(`[PROVIDER] Resolved @${providerAccount} memo key via ${node}`);
      return resolved;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[PROVIDER] Resolution via ${node} FAILED: ${lastError.message}`);
    }
  }

  throw new Error(
    `Could not resolve provider @${providerAccount}: ${lastError?.message || 'all nodes failed'}`,
  );
}

/**
 * Check whether a provider account is in the allowed list.
 *
 * In multi-tenant mode (allowedProviders is set), returns true only if
 * the provider is in the set. In single-tenant mode (no allowedProviders),
 * always returns true.
 */
export function isProviderAllowed(
  providerAccount: string,
  config: GiftcardConfig,
): boolean {
  if (!config.allowedProviders) return true;
  return config.allowedProviders.has(providerAccount.toLowerCase());
}
