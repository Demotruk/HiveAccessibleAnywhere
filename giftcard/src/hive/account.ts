/**
 * Hive blockchain operations for gift card account creation.
 *
 * Follows the Transaction → addOperation → sign → broadcast pattern
 * established in scripts/publish-feed.ts and scripts/distribute-onchain.ts.
 */

import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';
import type { GiftcardConfig } from '../config.js';
import { getSigningKey } from '../config.js';

// -- Types --

export interface PublicKeys {
  owner: string;
  active: string;
  posting: string;
  memo: string;
}

// -- Helpers --

/**
 * Build a single-key Hive Authority object.
 * Optionally includes account-level authorizations (e.g. apps granted posting authority).
 */
function makeAuthority(publicKey: string, accountAuths: [string, number][] = []) {
  return {
    weight_threshold: 1,
    account_auths: accountAuths,
    key_auths: [[publicKey, 1]] as [string, number][],
  };
}

/**
 * Apps pre-authorized on the posting authority at account creation.
 * This allows HiveSigner OAuth login to peakd.com without requiring the
 * user's active key — the user only needs their posting key to log in.
 */
const POSTING_ACCOUNT_AUTHS: [string, number][] = [
  ['peakd.app', 1],
];

/**
 * Wait for a specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -- Token count cache --

/**
 * Tiered TTL for pending account token cache. Higher counts mean the provider
 * is far from exhaustion, so we query less frequently. Low counts need frequent
 * checks to catch the zero-token transition promptly.
 */
function tokenCacheTtlMs(count: number): number {
  if (count > 1000) return 24 * 60 * 60 * 1000; // 24 hours
  if (count > 100)  return  4 * 60 * 60 * 1000;  //  4 hours
  if (count > 10)   return      30 * 60 * 1000;   // 30 minutes
  if (count > 0)    return       5 * 60 * 1000;    //  5 minutes
  return 0;                                         //  never cache zero — always re-check
}

/** Per-provider token count cache for multi-tenant support. */
const tokenCache = new Map<string, { count: number; expiresAt: number }>();

/**
 * Notify the cache that a token was just consumed by create_claimed_account.
 * Decrements the cached count so subsequent calls see the updated value
 * without an RPC round-trip.
 */
function decrementCachedTokenCount(provider: string): void {
  const entry = tokenCache.get(provider);
  if (entry && entry.count > 0) {
    entry.count--;
    // If the decremented count crosses into a shorter TTL tier, let it
    // expire sooner by recalculating. This ensures we start querying more
    // frequently as we approach zero.
    const remaining = entry.expiresAt - Date.now();
    const newTtl = tokenCacheTtlMs(entry.count);
    if (newTtl < remaining) {
      entry.expiresAt = Date.now() + newTtl;
    }
  }
}

// -- Queries --

/**
 * Get the number of pending (unclaimed) account creation tokens for a provider.
 * Returns the `pending_claimed_accounts` field from the provider's on-chain account.
 *
 * Results are cached per-provider with a tiered TTL: high token counts cache
 * for up to 24h, low counts for minutes, and zero is never cached.
 */
export async function getPendingAccountTokens(
  config: GiftcardConfig,
  providerAccount?: string,
): Promise<number> {
  const provider = providerAccount || config.providerAccount;

  // Return cached value if still valid
  const cached = tokenCache.get(provider);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[TOKENS] Using cached count: ${cached.count} (expires in ${Math.round((cached.expiresAt - Date.now()) / 1000)}s)`);
    return cached.count;
  }

  for (const node of config.hiveNodes) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const response = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_accounts',
          params: [[provider]],
          id: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const data = await response.json() as any;
      const account = data.result?.[0];
      if (!account) throw new Error(`Account @${provider} not found`);
      const count = account.pending_claimed_accounts ?? 0;

      // Update cache
      const ttl = tokenCacheTtlMs(count);
      tokenCache.set(provider, { count, expiresAt: Date.now() + ttl });

      console.log(`[TOKENS] @${provider} has ${count} pending account creation tokens (via ${node}, cached for ${Math.round(ttl / 1000)}s)`);
      return count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[TOKENS] Query via ${node} FAILED: ${msg}`);
    }
  }
  throw new Error('All Hive nodes failed for pending account tokens query');
}

/**
 * Get the current witness-median account creation fee (e.g. "3.000 HIVE").
 *
 * Uses condenser_api.get_chain_properties which returns the median fee set by
 * witnesses, not the hard-coded minimum from database_api.get_config.
 */
export async function getAccountCreationFee(
  config: GiftcardConfig,
): Promise<string> {
  for (const node of config.hiveNodes) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const response = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_chain_properties',
          params: [],
          id: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const data = await response.json() as any;
      const fee = data.result?.account_creation_fee;
      if (!fee) throw new Error('Could not parse account creation fee from chain properties');
      // fee is returned as a string like "3.000 HIVE"
      const feeStr = typeof fee === 'string' ? fee : `${fee} HIVE`;
      console.log(`[FEE] Account creation fee: ${feeStr} (via ${node})`);
      return feeStr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[FEE] Query via ${node} FAILED: ${msg}`);
    }
  }
  throw new Error('All Hive nodes failed for account creation fee query');
}

// -- Operations --

/**
 * Create a Hive account using create_claimed_account.
 *
 * Requires the provider account to have previously claimed account creation
 * tokens via the claim_account operation.
 *
 * In multi-tenant mode, `providerAccount` overrides the default config provider.
 * The transaction is signed with the service account's key (delegated authority)
 * or the provider's own active key in single-tenant mode.
 */
/** Options for post-creation operations that influence account setup. */
export interface AccountCreationOptions {
  /** Hive usernames the new account will auto-follow */
  autoFollow?: string[];
  /** Hive communities to subscribe the new account to */
  communities?: string[];
  /** Hive username to record as the account referrer */
  referrer?: string;
}

/**
 * Build json_metadata for account creation.
 * Includes referrer per the Hive Account Referral open standard if specified.
 */
function buildAccountMetadata(tokenHash?: string, referrer?: string): string {
  const metadata: Record<string, unknown> = { created_by: 'propolis-giftcard' };
  if (tokenHash) {
    metadata.giftcard_token_hash = tokenHash;
  }
  if (referrer) {
    metadata.beneficiaries = [
      { name: referrer, weight: 100, label: 'referrer' },
    ];
  }
  return JSON.stringify(metadata);
}

/**
 * Build the posting account_auths list. Adds the service/provider account
 * when auto-follow or community subscribe operations are needed, so the
 * service can broadcast those ops on behalf of the new account.
 */
function buildPostingAccountAuths(
  config: GiftcardConfig,
  providerAccount?: string,
  needsPostingAuth = false,
): [string, number][] {
  const auths = [...POSTING_ACCOUNT_AUTHS];
  if (needsPostingAuth) {
    const serviceAcct = config.serviceAccount || providerAccount || config.providerAccount;
    // Avoid duplicate if the service account is already in the list
    if (!auths.some(([name]) => name === serviceAcct)) {
      auths.push([serviceAcct, 1]);
    }
  }
  // Hive requires account_auths to be sorted alphabetically
  auths.sort((a, b) => a[0].localeCompare(b[0]));
  return auths;
}

export async function createAccount(
  config: GiftcardConfig,
  username: string,
  keys: PublicKeys,
  tokenHash?: string,
  providerAccount?: string,
  opts?: AccountCreationOptions,
): Promise<{ tx_id: string }> {
  hiveTxConfig.nodes = config.hiveNodes;

  const creator = providerAccount || config.providerAccount;
  const needsPostingAuth = !!((opts?.autoFollow && opts.autoFollow.length > 0)
    || (opts?.communities && opts.communities.length > 0));
  const postingAuths = buildPostingAccountAuths(config, providerAccount, needsPostingAuth);

  const tx = new Transaction();
  await tx.addOperation('create_claimed_account' as any, {
    creator,
    new_account_name: username,
    owner: makeAuthority(keys.owner),
    active: makeAuthority(keys.active),
    posting: makeAuthority(keys.posting, postingAuths),
    memo_key: keys.memo,
    json_metadata: buildAccountMetadata(tokenHash, opts?.referrer),
    extensions: [],
  } as any);

  const key = PrivateKey.from(getSigningKey(config));
  tx.sign(key);
  const result = await tx.broadcast(true) as any;
  return { tx_id: result.tx_id ?? result.id ?? 'unknown' };
}

/**
 * Create a Hive account by paying the on-chain creation fee (account_create).
 *
 * Fallback for when the provider has no pending account creation tokens.
 * Burns HIVE from the provider's liquid balance to pay the fee.
 */
export async function createAccountWithFee(
  config: GiftcardConfig,
  username: string,
  keys: PublicKeys,
  fee: string,
  tokenHash?: string,
  providerAccount?: string,
  opts?: AccountCreationOptions,
): Promise<{ tx_id: string }> {
  hiveTxConfig.nodes = config.hiveNodes;

  const creator = providerAccount || config.providerAccount;
  const needsPostingAuth = !!((opts?.autoFollow && opts.autoFollow.length > 0)
    || (opts?.communities && opts.communities.length > 0));
  const postingAuths = buildPostingAccountAuths(config, providerAccount, needsPostingAuth);

  const tx = new Transaction();
  await tx.addOperation('account_create' as any, {
    fee,
    creator,
    new_account_name: username,
    owner: makeAuthority(keys.owner),
    active: makeAuthority(keys.active),
    posting: makeAuthority(keys.posting, postingAuths),
    memo_key: keys.memo,
    json_metadata: buildAccountMetadata(tokenHash, opts?.referrer),
  } as any);

  const key = PrivateKey.from(getSigningKey(config));
  tx.sign(key);
  const result = await tx.broadcast(true) as any;
  return { tx_id: result.tx_id ?? result.id ?? 'unknown' };
}

/**
 * Delegate vesting shares (HP) to a new account so they have Resource Credits.
 *
 * In multi-tenant mode, `providerAccount` overrides the default delegator and
 * `delegationVests` can override the default amount (e.g. from batch promise_params).
 * Should be called after a short delay following account creation.
 */
export async function delegateVests(
  config: GiftcardConfig,
  username: string,
  providerAccount?: string,
  delegationVests?: string,
): Promise<void> {
  hiveTxConfig.nodes = config.hiveNodes;

  const tx = new Transaction();
  await tx.addOperation('delegate_vesting_shares' as any, {
    delegator: providerAccount || config.providerAccount,
    delegatee: username,
    vesting_shares: delegationVests || config.delegationVests,
  } as any);

  const key = PrivateKey.from(getSigningKey(config));
  tx.sign(key);
  await tx.broadcast(true);
}

/**
 * Broadcast follow + community subscribe operations for a new account.
 *
 * These operations require posting authority on the new account. At creation,
 * the service/provider account is added to the new account's posting
 * account_auths. To exercise that delegated authority, we must sign with the
 * service/provider's **posting key** (not active key — active key satisfies
 * posting-level ops only for the same account, not via account_auths).
 *
 * Requires GIFTCARD_POSTING_KEY to be configured.
 */
export async function broadcastFollowAndSubscribe(
  config: GiftcardConfig,
  username: string,
  autoFollow?: string[],
  communities?: string[],
): Promise<void> {
  const follows = autoFollow?.filter(Boolean) ?? [];
  const subs = communities?.filter(Boolean) ?? [];
  if (follows.length === 0 && subs.length === 0) return;

  if (!config.postingKey) {
    throw new Error('GIFTCARD_POSTING_KEY required for auto-follow/community subscribe');
  }

  hiveTxConfig.nodes = config.hiveNodes;

  const tx = new Transaction();

  for (const target of follows) {
    await tx.addOperation('custom_json' as any, {
      required_auths: [],
      required_posting_auths: [username],
      id: 'follow',
      json: JSON.stringify(['follow', { follower: username, following: target, what: ['blog'] }]),
    } as any);
  }

  for (const community of subs) {
    await tx.addOperation('custom_json' as any, {
      required_auths: [],
      required_posting_auths: [username],
      id: 'community',
      json: JSON.stringify(['subscribe', { community }]),
    } as any);
  }

  const key = PrivateKey.from(config.postingKey);
  tx.sign(key);
  await tx.broadcast(true);
}

/**
 * Enroll the new user in the endpoint feed by sending a 0.001 HBD
 * transfer to the HAA service account with the username in the memo.
 *
 * The feed publisher's discoverSubscribers() function will pick this up
 * and add the user to the endpoint feed on the next publish run.
 */
export async function enrollInFeed(
  config: GiftcardConfig,
  username: string,
  providerAccount?: string,
): Promise<void> {
  hiveTxConfig.nodes = config.hiveNodes;

  const tx = new Transaction();
  await tx.addOperation('transfer' as any, {
    from: providerAccount || config.providerAccount,
    to: config.haaServiceAccount,
    amount: '0.001 HBD',
    memo: username,
  } as any);

  const key = PrivateKey.from(getSigningKey(config));
  tx.sign(key);
  await tx.broadcast(true);
}

/**
 * Check if a Hive username is available (not taken).
 */
export async function isUsernameAvailable(
  config: GiftcardConfig,
  username: string,
): Promise<boolean> {
  for (const node of config.hiveNodes) {
    try {
      const t0 = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const response = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_accounts',
          params: [[username]],
          id: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const data = await response.json() as any;
      const available = !data.result || data.result.length === 0;
      console.log(`[USERNAME] @${username} check via ${node} → ${available ? 'available' : 'taken'} (${Date.now() - t0}ms)`);
      return available;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[USERNAME] @${username} check via ${node} FAILED: ${msg}`);
    }
  }
  throw new Error('All Hive nodes failed for username check');
}

/** Which account creation method was used */
export type CreationMethod = 'claimed' | 'paid';

/**
 * Execute the full account creation flow:
 * 1. Check pending account creation tokens
 * 2. Create account via token (create_claimed_account) or fee (account_create)
 * 3. Delegate HP (async — runs in background after 3s delay)
 *
 * Falls back to paying the on-chain creation fee if no tokens are available.
 * Returns immediately after account creation so the client gets a fast response.
 */
/**
 * Execute the full account creation flow:
 * 1. Check pending account creation tokens
 * 2. Create account via token (create_claimed_account) or fee (account_create)
 * 3. Delegate HP (async — runs in background after 3s delay)
 *
 * Falls back to paying the on-chain creation fee if no tokens are available.
 * Returns immediately after account creation so the client gets a fast response.
 *
 * In multi-tenant mode, `providerAccount` overrides the default provider and
 * `delegationVests` can override the default amount (e.g. from batch promise_params).
 */
export async function createAccountFull(
  config: GiftcardConfig,
  username: string,
  keys: PublicKeys,
  tokenHash?: string,
  providerAccount?: string,
  delegationVests?: string,
  opts?: AccountCreationOptions,
): Promise<{ tx_id: string; delegationOk: boolean; method: CreationMethod }> {
  const t0 = Date.now();
  const effectiveProvider = providerAccount || config.providerAccount;

  // Step 1: Check if provider has account creation tokens
  const pendingTokens = await getPendingAccountTokens(config, effectiveProvider);

  let result: { tx_id: string };
  let method: CreationMethod;

  if (pendingTokens > 0) {
    // Use free token path
    method = 'claimed';
    console.log(`[ACCOUNT] Broadcasting create_claimed_account for @${username} by @${effectiveProvider} (${pendingTokens} tokens remaining)`);
    result = await createAccount(config, username, keys, tokenHash, providerAccount, opts);
    decrementCachedTokenCount(effectiveProvider);
  } else {
    // Fallback: pay on-chain fee
    method = 'paid';
    console.log(`[ACCOUNT] No account creation tokens — falling back to paid account_create for @${username} by @${effectiveProvider}`);
    const fee = await getAccountCreationFee(config);
    result = await createAccountWithFee(config, username, keys, fee, tokenHash, providerAccount, opts);
  }

  console.log(`[ACCOUNT] Account @${username} created via ${method} in ${Date.now() - t0}ms (tx: ${result.tx_id.slice(0, 12)}...)`);

  // Step 2: Delegate HP in background — don't block the response
  delay(3000)
    .then(() => delegateVests(config, username, providerAccount, delegationVests))
    .then(() => console.log(`[DELEGATION OK] @${username}`))
    .catch((err) => {
      console.error(`[DELEGATION FAILED] @${username}: ${err instanceof Error ? err.message : String(err)}`);
    });

  // Step 3: Follow + community subscribe in background (parallel with delegation)
  if ((opts?.autoFollow && opts.autoFollow.length > 0) || (opts?.communities && opts.communities.length > 0)) {
    delay(3000)
      .then(() => broadcastFollowAndSubscribe(config, username, opts?.autoFollow, opts?.communities))
      .then(() => {
        const parts: string[] = [];
        if (opts?.autoFollow?.length) parts.push(`${opts.autoFollow.length} follows`);
        if (opts?.communities?.length) parts.push(`${opts.communities.length} communities`);
        console.log(`[FOLLOW/SUBSCRIBE OK] @${username}: ${parts.join(', ')}`);
      })
      .catch((err) => {
        console.error(`[FOLLOW/SUBSCRIBE FAILED] @${username}: ${err instanceof Error ? err.message : String(err)}`);
      });
  }

  return { tx_id: result.tx_id, delegationOk: true, method };
}
