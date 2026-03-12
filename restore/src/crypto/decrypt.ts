/**
 * AES-256-GCM decryption for key backups.
 *
 * Inverse of invite/src/crypto/encrypt.ts encryptWithPin().
 * Format: base64url(salt(16) || iv(12) || authTag(16) || ciphertext)
 * KDF: PBKDF2-SHA256, 100k iterations.
 */

const PBKDF2_ITERATIONS = 100_000;

/**
 * Base64url decode (no padding).
 */
function base64urlDecode(str: string): Uint8Array {
  // Restore standard base64
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Decrypt a PIN-encrypted backup string.
 * Returns the plaintext JSON string.
 * Throws on wrong PIN or corrupted data.
 */
export async function decryptWithPin(encrypted: string, pin: string): Promise<string> {
  const packed = base64urlDecode(encrypted);

  // Unpack: salt(16) || iv(12) || authTag(16) || ciphertext
  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const authTag = packed.slice(28, 44);
  const ciphertext = packed.slice(44);

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

  // Web Crypto expects ciphertext || authTag concatenated
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    combined,
  );

  return new TextDecoder().decode(decrypted);
}
