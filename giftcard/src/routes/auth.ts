/**
 * Authentication routes for the dashboard API.
 *
 * Implements Hive Keychain challenge-response authentication:
 * 1. Client requests a challenge for their username
 * 2. Client signs the challenge with Keychain (posting key)
 * 3. Service verifies the signature and issues a JWT
 */

import type { Request, Response } from 'express';
import type { GiftcardConfig } from '../config.js';
import { createChallenge, consumeChallenge } from '../auth/challenge.js';
import { verifyPostingSignature } from '../auth/verify.js';
import { signJwt } from '../auth/jwt.js';

/**
 * POST /auth/challenge
 * Generate a challenge string for Keychain signing.
 */
export function challengeHandler(config: GiftcardConfig) {
  return (req: Request, res: Response): void => {
    const { username } = req.body as { username?: string };
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Missing username' });
      return;
    }

    const normalized = username.toLowerCase().trim();

    // Issue challenge to any Hive user — authorization is handled by middleware
    const challenge = createChallenge(normalized);
    res.json({ challenge });
  };
}

/**
 * POST /auth/verify
 * Verify a signed challenge and return a JWT session token.
 */
export function verifyHandler(config: GiftcardConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    const { username, challenge, signature } = req.body as {
      username?: string;
      challenge?: string;
      signature?: string;
    };

    if (!username || !challenge || !signature) {
      res.status(400).json({ error: 'Missing username, challenge, or signature' });
      return;
    }

    const normalized = username.toLowerCase().trim();

    // Consume the challenge (one-time use)
    const entry = consumeChallenge(challenge);
    if (!entry) {
      res.status(400).json({ error: 'Invalid or expired challenge' });
      return;
    }

    // Verify the challenge was issued for this username
    if (entry.username !== normalized) {
      res.status(400).json({ error: 'Challenge was not issued for this username' });
      return;
    }

    if (!config.jwtSecret) {
      res.status(500).json({ error: 'Dashboard API not configured' });
      return;
    }

    try {
      const valid = await verifyPostingSignature(
        normalized,
        challenge,
        signature,
        config.hiveNodes,
      );

      if (!valid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const token = signJwt(normalized, config.jwtSecret);
      res.json({ token });
    } catch (err) {
      console.error('[AUTH] Verification failed:', err instanceof Error ? err.message : String(err));
      res.status(500).json({ error: 'Signature verification failed' });
    }
  };
}
