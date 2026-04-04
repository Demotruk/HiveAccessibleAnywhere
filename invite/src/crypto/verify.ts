/**
 * Gift card authenticity verification.
 *
 * Verifies the provider's signature over the card's canonical data
 * using hive-tx's Signature recovery. The expected public key is
 * the provider's memo_key fetched from the chain.
 *
 * Matches the server-side implementation in giftcard/src/crypto/signing.ts.
 */

import { Signature, PublicKey } from 'hive-tx';
import type { GiftCardPayload } from '../types';

/**
 * Build the canonical string for legacy per-card signature verification.
 * Must match giftcard/src/crypto/signing.ts canonicalString().
 */
function canonicalString(
  token: string,
  batchId: string,
  provider: string,
  expires: string,
  promiseType: string,
): string {
  return `${token}:${batchId}:${provider}:${expires}:${promiseType}`;
}

/**
 * Build the canonical string for batch-level signature verification.
 * Must match giftcard/src/crypto/signing.ts batchCanonicalString().
 */
function batchCanonicalString(
  merkleRoot: string,
  batchId: string,
  provider: string,
  expires: string,
  promiseType: string,
): string {
  return `${merkleRoot}:${batchId}:${provider}:${expires}:${promiseType}`;
}

/**
 * SHA-256 hash a string, returning Uint8Array.
 * Uses Web Crypto API (available in all modern browsers).
 */
async function sha256(message: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

/**
 * Verify a gift card's authenticity signature against the expected
 * public memo key. Supports both batch-signed and legacy per-card schemes.
 *
 * - merkleRoot present → batch-signed: canonical is <merkleRoot>:<batchId>:...
 * - merkleRoot absent  → legacy per-card: canonical is <token>:<batchId>:...
 */
export async function verifyCardSignature(
  payload: GiftCardPayload,
  memoPublicKeyStr: string,
): Promise<boolean> {
  const message = payload.merkleRoot
    ? batchCanonicalString(
        payload.merkleRoot,
        payload.batchId,
        payload.provider,
        payload.expires,
        payload.promiseType,
      )
    : canonicalString(
        payload.token,
        payload.batchId,
        payload.provider,
        payload.expires,
        payload.promiseType,
      );

  const msgHash = await sha256(message);
  const sig = Signature.from(payload.signature);
  const recoveredKey = sig.getPublicKey(msgHash);
  const expectedKey = PublicKey.from(memoPublicKeyStr);

  return recoveredKey.toString() === expectedKey.toString();
}

/**
 * Check if a gift card has expired.
 */
export function isExpired(payload: GiftCardPayload): boolean {
  return new Date() > new Date(payload.expires);
}
