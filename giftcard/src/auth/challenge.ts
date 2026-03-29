/**
 * In-memory challenge store for Hive Keychain authentication.
 *
 * Generates random challenges that the client signs with their posting key
 * via Hive Keychain. Challenges are single-use and expire after 5 minutes.
 */

import { randomBytes } from 'node:crypto';

interface ChallengeEntry {
  username: string;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

const store = new Map<string, ChallengeEntry>();

// Periodic cleanup of expired challenges
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.expiresAt) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Generate a new challenge for a username.
 * Returns a 64-character hex string that the client must sign.
 */
export function createChallenge(username: string): string {
  const challenge = randomBytes(32).toString('hex');
  store.set(challenge, {
    username: username.toLowerCase(),
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  return challenge;
}

/**
 * Consume a challenge, returning the username if valid.
 * The challenge is deleted after use (single-use).
 * Returns null if the challenge doesn't exist or has expired.
 */
export function consumeChallenge(challenge: string): { username: string } | null {
  const entry = store.get(challenge);
  if (!entry) return null;

  store.delete(challenge);

  if (Date.now() >= entry.expiresAt) return null;

  return { username: entry.username };
}
