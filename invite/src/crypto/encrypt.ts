/**
 * Browser-side AES-256-GCM encryption for key backup.
 *
 * Uses the same format as the gift card server encryption
 * (giftcard/src/crypto/signing.ts) so the same decrypt function works:
 *   salt(16) || iv(12) || authTag(16) || ciphertext
 * encoded as base64url.
 */

const PBKDF2_ITERATIONS = 100_000;

/**
 * Base64url encode (no padding).
 */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Encrypt plaintext with a PIN using AES-256-GCM + PBKDF2.
 * Returns base64url-encoded packed bytes matching server format.
 */
export async function encryptWithPin(plaintext: string, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

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
    ['encrypt'],
  );

  // Web Crypto returns ciphertext || authTag concatenated
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      aesKey,
      new TextEncoder().encode(plaintext),
    ),
  );

  // Extract authTag (last 16 bytes) and ciphertext
  const ciphertext = encrypted.slice(0, encrypted.length - 16);
  const authTag = encrypted.slice(encrypted.length - 16);

  // Pack as: salt(16) || iv(12) || authTag(16) || ciphertext
  const packed = new Uint8Array(16 + 12 + 16 + ciphertext.length);
  packed.set(salt, 0);
  packed.set(iv, 16);
  packed.set(authTag, 28);
  packed.set(ciphertext, 44);

  return base64urlEncode(packed);
}
