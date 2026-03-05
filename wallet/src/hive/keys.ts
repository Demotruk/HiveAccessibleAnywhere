/**
 * Key management: import, validate, and derive Hive keys.
 */

import { PrivateKey, PublicKey } from 'hive-tx';
import { getClient, type HiveAccount } from './client';

export type KeyRole = 'active' | 'posting' | 'memo' | 'owner';

export interface KeyPair {
  private: PrivateKey;
  public: PublicKey;
  role?: KeyRole;
}

/**
 * Import a private key from WIF (Wallet Import Format) string.
 * Returns the key pair (private + derived public key).
 */
export function importKey(wif: string): KeyPair {
  const privateKey = PrivateKey.from(wif);
  const publicKey = privateKey.createPublic();
  return { private: privateKey, public: publicKey };
}

/**
 * Validate that a key matches a specific role on an account.
 * Returns the matched role, or null if no match.
 */
export function matchKeyRole(
  publicKey: PublicKey,
  account: HiveAccount,
): KeyRole | null {
  const pubStr = publicKey.toString();

  // Check each authority level
  if (account.active.key_auths.some(([k]) => k === pubStr)) return 'active';
  if (account.posting.key_auths.some(([k]) => k === pubStr)) return 'posting';
  if (account.owner.key_auths.some(([k]) => k === pubStr)) return 'owner';
  if (account.memo_key === pubStr) return 'memo';

  return null;
}

/**
 * Import a key and identify which account and role it belongs to.
 * Tries to match against the given account name.
 */
export async function importAndValidateKey(
  wif: string,
  accountName: string,
): Promise<KeyPair & { role: KeyRole; account: HiveAccount }> {
  const keyPair = importKey(wif);
  const client = getClient();

  const accounts = await client.getAccounts([accountName]);
  if (accounts.length === 0) {
    throw new Error(`Account @${accountName} not found`);
  }

  const account = accounts[0];
  const role = matchKeyRole(keyPair.public, account);

  if (!role) {
    throw new Error(
      `Key does not match any authority on @${accountName}`,
    );
  }

  return { ...keyPair, role, account };
}

/**
 * Parse an asset string like "1.234 HBD" into amount and symbol.
 */
export function parseAsset(asset: string): { amount: number; symbol: string } {
  const parts = asset.trim().split(' ');
  if (parts.length !== 2) throw new Error(`Invalid asset format: ${asset}`);
  return {
    amount: parseFloat(parts[0]),
    symbol: parts[1],
  };
}

/**
 * Format a number + symbol into a Hive asset string (3 decimal places).
 */
export function formatAsset(amount: number, symbol: 'HIVE' | 'HBD'): string {
  return `${amount.toFixed(3)} ${symbol}`;
}
