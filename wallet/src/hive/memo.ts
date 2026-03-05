/**
 * Memo encryption and decryption using Hive's native memo key pairs.
 */

import { Memo } from 'hive-tx';

/**
 * Decrypt an encrypted Hive memo.
 *
 * @param encryptedMemo - The encrypted memo string (starts with '#')
 * @param privateKeyWif - The recipient's private memo key in WIF format
 * @returns The decrypted plaintext memo
 */
export function decryptMemo(
  encryptedMemo: string,
  privateKeyWif: string,
): string {
  if (!encryptedMemo.startsWith('#')) {
    // Not encrypted, return as-is
    return encryptedMemo;
  }

  const decoded = Memo.decode(privateKeyWif, encryptedMemo);
  // Memo.decode() returns the original plaintext with the '#' prefix intact — strip it
  return decoded.startsWith('#') ? decoded.slice(1) : decoded;
}

/**
 * Encrypt a memo for a specific recipient.
 *
 * @param memo - The plaintext memo to encrypt
 * @param senderPrivateKeyWif - Sender's private memo key (WIF)
 * @param recipientPublicKey - Recipient's public memo key
 * @returns The encrypted memo string (prefixed with '#')
 */
export function encryptMemo(
  memo: string,
  senderPrivateKeyWif: string,
  recipientPublicKey: string,
): string {
  return Memo.encode(senderPrivateKeyWif, recipientPublicKey, `#${memo}`);
}
