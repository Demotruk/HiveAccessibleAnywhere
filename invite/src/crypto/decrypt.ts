/**
 * Browser-side AES-256-GCM decryption of gift card payloads.
 *
 * The server (giftcard/src/crypto/signing.ts) encrypts as:
 *   salt(16) || iv(12) || authTag(16) || ciphertext
 * encoded as base64url.
 *
 * Web Crypto API expects ciphertext || authTag concatenated,
 * so we rearrange the packed bytes before decrypting.
 */

import type { GiftCardPayload } from '../types';

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

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
 * Decrypt a PIN-encrypted gift card payload using Web Crypto API.
 * Throws on wrong PIN (OperationError from AES-GCM auth tag mismatch).
 */
export async function decryptPayload(
  blob: string,
  pin: string,
): Promise<GiftCardPayload> {
  const packed = base64urlDecode(blob);

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

  return JSON.parse(new TextDecoder().decode(decrypted)) as GiftCardPayload;
}
