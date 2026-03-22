/**
 * Session storage caching for invite flow intermediate state.
 *
 * Caches state at checkpoints so the user can resume if connectivity
 * drops or they accidentally refresh. The encrypted blob is consumed
 * on first load (URL fragment cleared), so caching is the only way
 * to support resumption.
 *
 * Keys are re-encrypted with PIN before caching — never stored in
 * plaintext in sessionStorage.
 */

import { encryptWithPin } from './crypto/encrypt';
import { decryptPayload } from './crypto/decrypt';
import type { InviteState, GiftCardPayload, DerivedKeys } from './types';

const CACHE_KEY = 'propolis_invite_state';

interface CachedState {
  /** The encrypted blob (original from URL fragment) */
  encryptedBlob: string;
  /** PIN (needed to decrypt the blob and any re-encrypted keys) */
  pin: string;
  /** Whether verification passed */
  verified: boolean;
  /** Chosen username (if set) */
  username?: string;
  /** Keys re-encrypted with PIN (if backed up) */
  encryptedKeys?: string;
  /** Claim result (if account created) */
  claimResult?: { account: string; tx_id: string };
  /** Screen to resume from */
  resumeScreen: string;
}

/**
 * Save a checkpoint to sessionStorage.
 */
export async function saveCheckpoint(
  state: InviteState,
  screen: string,
): Promise<void> {
  if (!state.encryptedBlob || !state.pin) return;

  const cached: CachedState = {
    encryptedBlob: state.encryptedBlob,
    pin: state.pin,
    verified: !!state.payload,
    resumeScreen: screen,
  };

  if (state.username) {
    cached.username = state.username;
  }

  if (state.keys) {
    // Re-encrypt keys with PIN for safe session storage
    const keysJson = JSON.stringify(state.keys);
    cached.encryptedKeys = await encryptWithPin(keysJson, state.pin);
  }

  if (state.claimResult) {
    cached.claimResult = state.claimResult;
  }

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch { /* storage full or unavailable */ }
}

/**
 * Attempt to restore state from a cached checkpoint.
 * Returns the partially restored state and resume screen, or null.
 */
export async function loadCheckpoint(): Promise<{
  state: Partial<InviteState>;
  resumeScreen: string;
} | null> {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cached: CachedState = JSON.parse(raw);
    if (!cached.encryptedBlob || !cached.pin) return null;

    const partial: Partial<InviteState> = {
      encryptedBlob: cached.encryptedBlob,
      pin: cached.pin,
    };

    // Re-decrypt the payload if verification had passed
    if (cached.verified) {
      try {
        partial.payload = await decryptPayload(cached.encryptedBlob, cached.pin);
      } catch { return null; /* corrupt cache */ }
    }

    if (cached.username) {
      partial.username = cached.username;
    }

    if (cached.encryptedKeys && cached.pin) {
      try {
        // Decrypt the re-encrypted keys
        const decrypted = await decryptReEncryptedKeys(cached.encryptedKeys, cached.pin);
        partial.keys = decrypted;
      } catch { /* ignore — keys not recoverable, user re-does backup */ }
    }

    if (cached.claimResult) {
      partial.claimResult = cached.claimResult;
    }

    return { state: partial, resumeScreen: cached.resumeScreen };
  } catch {
    return null;
  }
}

/**
 * Clear the cached checkpoint (on success or explicit abandonment).
 */
export function clearCheckpoint(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch { /* ignore */ }
}

/**
 * Decrypt re-encrypted keys from session cache.
 * Uses the same PBKDF2 + AES-256-GCM as encryptWithPin but via Web Crypto decrypt.
 */
async function decryptReEncryptedKeys(blob: string, pin: string): Promise<DerivedKeys> {
  // The blob is base64url-encoded: salt(16) || iv(12) || authTag(16) || ciphertext
  // Same format as encryptWithPin output
  const packed = base64urlDecode(blob);
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
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const dataWithTag = new Uint8Array(ciphertext.length + 16);
  dataWithTag.set(ciphertext, 0);
  dataWithTag.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    dataWithTag,
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

function base64urlDecode(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
