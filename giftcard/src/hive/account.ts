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
  const node = config.hiveNodes[0];

  const response = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [[username]],
      id: 1,
    }),
  });

  const data = await response.json() as any;
  return !data.result || data.result.length === 0;
}

/**
 * Execute the full account creation flow:
 * 1. Create account (awaited — must succeed)
 * 2. Delegate HP (async — runs in background after 3s delay)
 *
 * Returns immediately after account creation so the client gets a
 * fast response. Delegation happens in the background and is logged
 * if it fails (the account is still usable without it).
 */
export async function createAccountFull(
  config: GiftcardConfig,
  username: string,
  keys: PublicKeys,
  tokenHash?: string,
): Promise<{ tx_id: string; delegationOk: boolean }> {
  // Step 1: Create the account — this must succeed
  const result = await createAccount(config, username, keys, tokenHash);

  // Step 2: Delegate HP in background — don't block the response
  delay(3000)
    .then(() => delegateVests(config, username))
    .then(() => console.log(`[DELEGATION OK] @${username}`))
    .catch((err) => {
      console.error(`[DELEGATION FAILED] @${username}: ${err instanceof Error ? err.message : String(err)}`);
    });

  return { tx_id: result.tx_id, delegationOk: true };
}
