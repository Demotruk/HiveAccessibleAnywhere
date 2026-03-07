/**
 * Cryptographic utilities for gift card token signing, verification,
 * Merkle tree construction, and PIN-based payload encryption.
 */

import { createHash, randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto';
import { Signature, PublicKey, PrivateKey } from 'hive-tx';

// -- Authenticity Signing --

/**
 * Build the canonical string for signing a gift card.
 *
 * The promiseType field makes the signature commit to what the card promises
 * (e.g. 'account-creation', 'transfer', 'delegation'), preventing a batch
 * of one type from being reinterpreted as another.
 */
export function canonicalString(
  token: string,
  batchId: string,
  provider: string,
  expires: string,
  promiseType: string,
): string {
  return `${token}:${batchId}:${provider}:${expires}:${promiseType}`;
}

/**
 * Sign a gift card's canonical data with the provider's memo private key.
 * Returns a hex-encoded signature string.
 */
export function signCardData(
  token: string,
  batchId: string,
  provider: string,
  expires: string,
  promiseType: string,
  memoPrivateKeyWif: string,
): string {
  const message = canonicalString(token, batchId, provider, expires, promiseType);
  const msgHash = createHash('sha256').update(message, 'utf-8').digest();
  const key = PrivateKey.from(memoPrivateKeyWif);
  const sig = key.sign(msgHash);
  return sig.customToString();
}

/**
 * Verify a gift card's authenticity signature against the provider's public memo key.
 */
export function verifyCardSignature(
  token: string,
  batchId: string,
  provider: string,
  expires: string,
  promiseType: string,
  signatureHex: string,
  memoPublicKeyStr: string,
): boolean {
  const message = canonicalString(token, batchId, provider, expires, promiseType);
  const msgHash = createHash('sha256').update(message, 'utf-8').digest();
  const sig = Signature.from(signatureHex);
  const recoveredKey = sig.getPublicKey(msgHash);
  const expectedKey = PublicKey.from(memoPublicKeyStr);
  return recoveredKey.toString() === expectedKey.toString();
}

// -- Merkle Tree --

/**
 * Compute SHA-256 hash of a token string.
 */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf-8').digest();
}

/**
 * Build a Merkle tree from a list of token strings and return the root hash.
 * Tokens are sorted before hashing to ensure deterministic ordering.
 */
export function merkleRoot(tokens: string[]): string {
  if (tokens.length === 0) return '';

  // Hash each token
  let hashes = tokens
    .slice()
    .sort()
    .map(t => hashToken(t));

  // Build tree bottom-up
  while (hashes.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        // Hash pair
        const combined = Buffer.concat([hashes[i], hashes[i + 1]]);
        next.push(createHash('sha256').update(combined).digest());
      } else {
        // Odd node — promote as-is
        next.push(hashes[i]);
      }
    }
    hashes = next;
  }

  return hashes[0].toString('hex');
}

// -- PIN Encryption / Decryption --

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypted blob payload contents.
 *
 * promiseType identifies what the card promises (e.g. 'account-creation',
 * 'transfer', 'delegation'). promiseParams carries type-specific batch-level
 * metadata (e.g. { amount: '10.000 HIVE' } for a transfer card).
 */
export interface GiftCardPayload {
  token: string;
  provider: string;
  serviceUrl: string;
  endpoints: string[];
  batchId: string;
  expires: string;
  signature: string;
  promiseType: string;
  promiseParams?: Record<string, unknown>;
}

/**
 * Encrypt a gift card payload with a PIN using AES-256-GCM.
 * Returns a base64url-encoded string suitable for use in a URL fragment.
 *
 * Format: salt(16) || iv(12) || authTag(16) || ciphertext
 */
export function encryptPayload(payload: GiftCardPayload, pin: string): string {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf-8');
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from PIN
  const key = pbkdf2Sync(pin, salt, PBKDF2_ITERATIONS, 32, 'sha256');

  // Encrypt with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: salt || iv || authTag || ciphertext
  const packed = Buffer.concat([salt, iv, authTag, encrypted]);

  return packed.toString('base64url');
}

/**
 * Decrypt a gift card payload using the PIN.
 * Returns the parsed payload, or throws on failure (wrong PIN, corrupted data).
 */
export function decryptPayload(blob: string, pin: string): GiftCardPayload {
  const packed = Buffer.from(blob, 'base64url');

  const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  if (packed.length < minLength) {
    throw new Error('Invalid encrypted data: too short');
  }

  const salt = packed.subarray(0, SALT_LENGTH);
  const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from PIN
  const key = pbkdf2Sync(pin, salt, PBKDF2_ITERATIONS, 32, 'sha256');

  // Decrypt
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8')) as GiftCardPayload;
}

// -- Token & PIN Generation --

/**
 * Generate a cryptographically random claim token (32 bytes, hex-encoded = 64 chars).
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a 6-character alphanumeric PIN.
 * Uses a restricted alphabet that excludes ambiguous characters: 0/O, 1/I/L.
 */
export function generatePin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += chars[bytes[i] % chars.length];
  }
  return pin;
}
