/**
 * Browser-side AES-256-GCM decryption of gift card payloads.
 *
 * The server (giftcard/src/crypto/signing.ts) encrypts as:
 *   'c1:' + base64url( salt(16) || iv(12) || authTag(16) || ciphertext )
 *
 * The ciphertext contains deflate-compressed JSON with short keys.
 * Legacy blobs (without 'c1:' prefix) are also supported.
 *
 * Web Crypto API expects ciphertext || authTag concatenated,
 * so we rearrange the packed bytes before decrypting.
 */

import type { GiftCardPayload } from '../types';

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const COMPRESSED_PREFIX = 'c1:';

/** Maps short keys back to full GiftCardPayload keys. */
const SHORT_TO_LONG: Record<string, string> = {
  t: 'token',
  p: 'provider',
  s: 'serviceUrl',
  e: 'endpoints',
  b: 'batchId',
  x: 'expires',
  g: 'signature',
  y: 'promiseType',
  pp: 'promiseParams',
  m: 'merkleProof',
};

function fromShortKeys(obj: Record<string, unknown>): GiftCardPayload {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[SHORT_TO_LONG[key] || key] = value;
  }
  return result as unknown as GiftCardPayload;
}

/**
 * Base64url decode (no padding) to Uint8Array.
 */
function base64urlDecode(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Inflate raw-deflate compressed data using the Compression Streams API.
 */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writer.write(data as any);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  let totalLength = 0;
  for (const chunk of chunks) totalLength += chunk.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Decrypt a PIN-encrypted gift card payload using Web Crypto API.
 * Handles both compressed (c1: prefix) and legacy uncompressed blobs.
 * Throws on wrong PIN (OperationError from AES-GCM auth tag mismatch).
 */
export async function decryptPayload(
  blob: string,
  pin: string,
): Promise<GiftCardPayload> {
  const isCompressed = blob.startsWith(COMPRESSED_PREFIX);
  const encoded = isCompressed ? blob.slice(COMPRESSED_PREFIX.length) : blob;

  const packed = base64urlDecode(encoded);

  const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  if (packed.length < minLength) {
    throw new Error('Invalid encrypted data');
  }

  const salt = packed.slice(0, SALT_LENGTH);
  const iv = packed.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = packed.slice(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
  );
  const ciphertext = packed.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from PIN using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  // Web Crypto AES-GCM expects ciphertext || authTag concatenated
  const dataWithTag = new Uint8Array(ciphertext.length + AUTH_TAG_LENGTH);
  dataWithTag.set(ciphertext, 0);
  dataWithTag.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    dataWithTag,
  );

  if (isCompressed) {
    const inflated = await inflate(new Uint8Array(decrypted));
    const obj = JSON.parse(new TextDecoder().decode(inflated));
    return fromShortKeys(obj);
  }
  return JSON.parse(new TextDecoder().decode(decrypted)) as GiftCardPayload;
}
