/**
 * Cryptographic utilities for gift card token signing, verification,
 * Merkle tree construction, and PIN-based payload encryption.
 */

import { createHash, randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
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
 * A single step in a Merkle inclusion proof.
 * `hash` is the hex-encoded sibling hash, `position` is the sibling's
 * position relative to the current node ('left' or 'right').
 */
export interface MerkleProofStep {
  hash: string;
  position: 'left' | 'right';
}

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

/**
 * Generate a Merkle inclusion proof for a specific token.
 * The proof is an array of sibling hashes that, combined with the token's
 * own hash, reconstruct the Merkle root.
 *
 * Tokens are sorted before tree construction (same as merkleRoot()).
 */
export function generateMerkleProof(tokens: string[], targetToken: string): MerkleProofStep[] {
  if (tokens.length === 0) throw new Error('Cannot generate proof for empty token list');

  const sorted = tokens.slice().sort();
  let idx = sorted.indexOf(targetToken);
  if (idx === -1) throw new Error('Target token not found in token list');

  let hashes = sorted.map(t => hashToken(t));
  const proof: MerkleProofStep[] = [];

  while (hashes.length > 1) {
    const next: Buffer[] = [];
    let nextIdx = -1;

    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        // Pair exists
        if (i === idx) {
          // Our node is on the left — sibling is on the right
          proof.push({ hash: hashes[i + 1].toString('hex'), position: 'right' });
          nextIdx = Math.floor(i / 2);
        } else if (i + 1 === idx) {
          // Our node is on the right — sibling is on the left
          proof.push({ hash: hashes[i].toString('hex'), position: 'left' });
          nextIdx = Math.floor(i / 2);
        }
        const combined = Buffer.concat([hashes[i], hashes[i + 1]]);
        next.push(createHash('sha256').update(combined).digest());
      } else {
        // Odd node promoted as-is — no sibling, no proof step
        if (i === idx) {
          nextIdx = Math.floor(i / 2);
        }
        next.push(hashes[i]);
      }
    }

    hashes = next;
    idx = nextIdx;
  }

  return proof;
}

/**
 * Verify a Merkle inclusion proof against an expected root.
 *
 * @param tokenHash - hex-encoded SHA-256 hash of the token
 * @param proof - array of sibling hashes from generateMerkleProof()
 * @param expectedRoot - hex-encoded expected Merkle root
 */
export function verifyMerkleProof(
  tokenHash: string,
  proof: MerkleProofStep[],
  expectedRoot: string,
): boolean {
  let current = Buffer.from(tokenHash, 'hex');

  for (const step of proof) {
    const sibling = Buffer.from(step.hash, 'hex');
    if (step.position === 'left') {
      // Sibling is on the left: hash(sibling || current)
      current = createHash('sha256').update(Buffer.concat([sibling, current])).digest();
    } else {
      // Sibling is on the right: hash(current || sibling)
      current = createHash('sha256').update(Buffer.concat([current, sibling])).digest();
    }
  }

  return current.toString('hex') === expectedRoot;
}

/**
 * Encode a Merkle proof as a compact string for payload transport.
 * Format: each step is 'L' or 'R' followed by 64-char hex hash, concatenated.
 * Example: "Labcdef...64chars...R012345...64chars..."
 */
export function encodeMerkleProof(proof: MerkleProofStep[]): string {
  return proof.map(s => (s.position === 'left' ? 'L' : 'R') + s.hash).join('');
}

/**
 * Decode a compact Merkle proof string back into MerkleProofStep array.
 */
export function decodeMerkleProof(compact: string): MerkleProofStep[] {
  const steps: MerkleProofStep[] = [];
  for (let i = 0; i < compact.length; i += 65) {
    const dir = compact[i];
    const hash = compact.slice(i + 1, i + 65);
    steps.push({ hash, position: dir === 'L' ? 'left' : 'right' });
  }
  return steps;
}

// -- PIN Encryption / Decryption --

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Version prefix for compressed+short-keyed payloads.
 * Blobs without this prefix are legacy uncompressed format.
 */
const COMPRESSED_PREFIX = 'c1:';

/** Maps full GiftCardPayload keys to short keys for smaller JSON. */
const LONG_TO_SHORT: Record<string, string> = {
  token: 't',
  provider: 'p',
  serviceUrl: 's',
  endpoints: 'e',
  batchId: 'b',
  expires: 'x',
  signature: 'g',
  promiseType: 'y',
  promiseParams: 'pp',
  merkleProof: 'm',
  variant: 'v',
  locale: 'l',
  autoFollow: 'af',
  communities: 'cm',
  referrer: 'rf',
};

const SHORT_TO_LONG: Record<string, string> = Object.fromEntries(
  Object.entries(LONG_TO_SHORT).map(([k, v]) => [v, k]),
);

function toShortKeys(payload: GiftCardPayload): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      result[LONG_TO_SHORT[key] || key] = value;
    }
  }
  return result;
}

function fromShortKeys(obj: Record<string, unknown>): GiftCardPayload {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[SHORT_TO_LONG[key] || key] = value;
  }
  return result as GiftCardPayload;
}

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
  /** Compact-encoded Merkle inclusion proof (see encodeMerkleProof) */
  merkleProof?: string;
  /** Card variant: 'standard' (HiveSigner redirect) or 'robust' (proxy + bootstrap) */
  variant: 'standard' | 'robust';
  /** Wallet locale for robust invites (determines which on-chain wallet to fetch) */
  locale?: string;
  /** Hive usernames the new account will auto-follow on creation (max 20) */
  autoFollow?: string[];
  /** Hive communities to subscribe the new account to on creation (max 10) */
  communities?: string[];
  /** Hive username to record as account referrer (Hive Account Referral open standard) */
  referrer?: string;
}

/**
 * Encrypt a gift card payload with a PIN using AES-256-GCM.
 * Returns a base64url-encoded string suitable for use in a URL fragment.
 *
 * Uses short JSON keys and deflate compression to minimise QR code size.
 * Output is prefixed with 'c1:' to distinguish from legacy uncompressed blobs.
 *
 * Format: 'c1:' + base64url( salt(16) || iv(12) || authTag(16) || ciphertext )
 */
export function encryptPayload(payload: GiftCardPayload, pin: string): string {
  // Short keys + deflate for smaller output
  const json = Buffer.from(JSON.stringify(toShortKeys(payload)), 'utf-8');
  const plaintext = deflateRawSync(json);

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

  return COMPRESSED_PREFIX + packed.toString('base64url');
}

/**
 * Decrypt a gift card payload using the PIN.
 * Handles both compressed (c1: prefix) and legacy uncompressed blobs.
 * Returns the parsed payload, or throws on failure (wrong PIN, corrupted data).
 */
export function decryptPayload(blob: string, pin: string): GiftCardPayload {
  const isCompressed = blob.startsWith(COMPRESSED_PREFIX);
  const encoded = isCompressed ? blob.slice(COMPRESSED_PREFIX.length) : blob;

  const packed = Buffer.from(encoded, 'base64url');

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

  if (isCompressed) {
    const inflated = inflateRawSync(decrypted);
    return fromShortKeys(JSON.parse(inflated.toString('utf-8')));
  }
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
 * Uses a restricted alphabet that excludes ambiguous characters: 0/O, 1/I.
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
