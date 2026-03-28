/**
 * Hive blockchain operations for gift card account creation.
 *
 * Follows the Transaction → addOperation → sign → broadcast pattern
 * established in scripts/publish-feed.ts and scripts/distribute-onchain.ts.
 */

import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';
import type { GiftcardConfig } from '../config.js';

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

// -- Queries --

/**
 * Get the number of pending (unclaimed) account creation tokens for a provider.
 * Returns the `pending_claimed_accounts` field from the provider's on-chain account.
 */
export async function getPendingAccountTokens(
  config: GiftcardConfig,
): Promise<number> {
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
          params: [[config.providerAccount]],
          id: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const data = await response.json() as any;
      const account = data.result?.[0];
      if (!account) throw new Error(`Account @${config.providerAccount} not found`);
      const count = account.pending_claimed_accounts ?? 0;
      console.log(`[TOKENS] @${config.providerAccount} has ${count} pending account creation tokens (via ${node})`);
      return count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[TOKENS] Query via ${node} FAILED: ${msg}`);
    }
  }
  throw new Error('All Hive nodes failed for pending account tokens query');
}

/**
 * Get the current on-chain account creation fee (e.g. "3.000 HIVE").
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
          method: 'database_api.get_config',
          params: {},
          id: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const data = await response.json() as any;
      // database_api.get_config returns the fee under various keys depending on node version
      const fee = data.result?.HIVE_MIN_ACCOUNT_CREATION_FEE;
      if (!fee) throw new Error('Could not parse account creation fee from chain config');
      // The fee is returned as a number (in HIVE). Format it as asset string.
      const feeStr = typeof fee === 'number' ? `${fee.toFixed(3)} HIVE` : String(fee);
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
 */
export async function createAccount(
  config: GiftcardConfig,
  username: string,
  keys: PublicKeys,
  tokenHash?: string,
): Promise<{ tx_id: string }> {
  hiveTxConfig.nodes = config.hiveNodes;

  // Include the gift card token hash in json_metadata so the account creation
  // can be linked back to the specific gift card token on-chain. This enables
  // third-party auditing: observers can verify that batch declarations
  // (merkle root + count) match the number of fulfilled accounts.
  const metadata: Record<string, unknown> = { created_by: 'propolis-giftcard' };
  if (tokenHash) {
    metadata.giftcard_token_hash = tokenHash;
  }

  const tx = new Transaction();
  await tx.addOperation('create_claimed_account' as any, {
    creator: config.providerAccount,
    new_account_name: username,
    owner: makeAuthority(keys.owner),
    active: makeAuthority(keys.active),
    posting: makeAuthority(keys.posting, POSTING_ACCOUNT_AUTHS),
    memo_key: keys.memo,
    json_metadata: JSON.stringify(metadata),
    extensions: [],
  } as any);

  const key = PrivateKey.from(config.activeKey);
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
): Promise<{ tx_id: string }> {
  hiveTxConfig.nodes = config.hiveNodes;

  const metadata: Record<string, unknown> = { created_by: 'propolis-giftcard' };
  if (tokenHash) {
    metadata.giftcard_token_hash = tokenHash;
  }

  const tx = new Transaction();
  await tx.addOperation('account_create' as any, {
    fee,
    creator: config.providerAccount,
    new_account_name: username,
    owner: makeAuthority(keys.owner),
    active: makeAuthority(keys.active),
    posting: makeAuthority(keys.posting, POSTING_ACCOUNT_AUTHS),
    memo_key: keys.memo,
    json_metadata: JSON.stringify(metadata),
  } as any);

  const key = PrivateKey.from(config.activeKey);
  tx.sign(key);
  const result = await tx.broadcast(true) as any;
  return { tx_id: result.tx_id ?? result.id ?? 'unknown' };
}

/**
 * Delegate vesting shares (HP) to a new account so they have Resource Credits.
 *
 * Should be called after a short delay following account creation.
 */
export async function delegateVests(
  config: GiftcardConfig,
  username: string,
): Promise<void> {
  hiveTxConfig.nodes = config.hiveNodes;

  const tx = new Transaction();
  await tx.addOperation('delegate_vesting_shares' as any, {
    delegator: config.providerAccount,
    delegatee: username,
    vesting_shares: config.delegationVests,
  } as any);

  const key = PrivateKey.from(config.activeKey);
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
): Promise<void> {
  hiveTxConfig.nodes = config.hiveNodes;

  const tx = new Transaction();
  await tx.addOperation('transfer' as any, {
    from: config.providerAccount,
    to: config.haaServiceAccount,
    amount: '0.001 HBD',
    memo: username,
  } as any);

  const key = PrivateKey.from(config.activeKey);
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
export async function createAccountFull(
  config: GiftcardConfig,
  username: string,
  keys: PublicKeys,
  tokenHash?: string,
): Promise<{ tx_id: string; delegationOk: boolean; method: CreationMethod }> {
  const t0 = Date.now();

  // Step 1: Check if provider has account creation tokens
  const pendingTokens = await getPendingAccountTokens(config);

  let result: { tx_id: string };
  let method: CreationMethod;

  if (pendingTokens > 0) {
    // Use free token path
    method = 'claimed';
    console.log(`[ACCOUNT] Broadcasting create_claimed_account for @${username} (${pendingTokens} tokens remaining)`);
    result = await createAccount(config, username, keys, tokenHash);
  } else {
    // Fallback: pay on-chain fee
    method = 'paid';
    console.log(`[ACCOUNT] No account creation tokens — falling back to paid account_create for @${username}`);
    const fee = await getAccountCreationFee(config);
    result = await createAccountWithFee(config, username, keys, fee, tokenHash);
  }

  console.log(`[ACCOUNT] Account @${username} created via ${method} in ${Date.now() - t0}ms (tx: ${result.tx_id.slice(0, 12)}...)`);

  // Step 2: Delegate HP in background — don't block the response
  delay(3000)
    .then(() => delegateVests(config, username))
    .then(() => console.log(`[DELEGATION OK] @${username}`))
    .catch((err) => {
      console.error(`[DELEGATION FAILED] @${username}: ${err instanceof Error ? err.message : String(err)}`);
    });

  return { tx_id: result.tx_id, delegationOk: true, method };
}
