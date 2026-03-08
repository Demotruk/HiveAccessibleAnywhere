/**
 * Key generation for new Hive accounts.
 *
 * Generates a random master password, then derives all four key pairs
 * from username + password using the standard Hive derivation
 * (PrivateKey.fromLogin). This is the same scheme used by hive.blog,
 * Hivesigner, and all major Hive wallets.
 */

import { PrivateKey } from 'hive-tx';
import type { DerivedKeys } from '../types';

type KeyRole = 'owner' | 'active' | 'posting' | 'memo';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Generate a random master password.
 * Format: P5 prefix + 48 random base58 characters (50 chars total).
 * The P5 prefix signals it's a Hive master password.
 */
export function generateMasterPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  let password = 'P5';
  for (let i = 0; i < 48; i++) {
    password += BASE58_ALPHABET[bytes[i] % BASE58_ALPHABET.length];
  }
  return password;
}

/**
 * Derive all four Hive key pairs from username + master password.
 * Uses PrivateKey.fromLogin(username, password, role) which internally
 * does SHA256(username + role + password) → private key.
 */
export function deriveKeys(username: string, password: string): DerivedKeys {
  function derive(role: KeyRole) {
    const priv = PrivateKey.fromLogin(username, password, role);
    return { wif: priv.toString(), pub: priv.createPublic().toString() };
  }

  return {
    owner: derive('owner'),
    active: derive('active'),
    posting: derive('posting'),
    memo: derive('memo'),
  };
}

/**
 * Get the public keys structure expected by the /claim endpoint.
 */
export function getPublicKeys(keys: DerivedKeys): {
  owner: string;
  active: string;
  posting: string;
  memo: string;
} {
  return {
    owner: keys.owner.pub,
    active: keys.active.pub,
    posting: keys.posting.pub,
    memo: keys.memo.pub,
  };
}
