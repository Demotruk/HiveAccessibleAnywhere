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
 */
function makeAuthority(publicKey: string) {
  return {
    weight_threshold: 1,
    account_auths: [] as [string, number][],
    key_auths: [[publicKey, 1]] as [string, number][],
  };
}

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
    posting: makeAuthority(keys.posting),
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
 * 1. Create account
 * 2. Delegate HP (after 3s delay)
 * 3. Enroll in endpoint feed (after 3s delay)
 *
 * If account creation fails, throws immediately.
 * If delegation or enrollment fails, logs the error but does not throw
 * (the account already exists and the user can use it).
 */
export async function createAccountFull(
  config: GiftcardConfig,
  username: string,
  keys: PublicKeys,
  tokenHash?: string,
): Promise<{ tx_id: string; delegationOk: boolean; enrollmentOk: boolean }> {
  // Step 1: Create the account — this must succeed
  const result = await createAccount(config, username, keys, tokenHash);

  // Step 2: Delegate HP — log failure but continue
  let delegationOk = true;
  try {
    await delay(3000);
    await delegateVests(config, username);
  } catch (err) {
    delegationOk = false;
    console.error(`[DELEGATION FAILED] @${username}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 3: Enroll in feed — log failure but continue
  let enrollmentOk = true;
  try {
    await delay(3000);
    await enrollInFeed(config, username);
  } catch (err) {
    enrollmentOk = false;
    console.error(`[ENROLLMENT FAILED] @${username}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { tx_id: result.tx_id, delegationOk, enrollmentOk };
}
