/**
 * POST /validate — Pre-flight token validation.
 *
 * The wallet calls this before showing the username selection screen,
 * to confirm the token is still valid before proceeding.
 */

import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getTokenWithBatch } from '../db.js';

export function validateHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const { token } = req.body as { token?: string };

    if (!token || typeof token !== 'string') {
      res.status(400).json({ valid: false, reason: 'Missing token' });
      return;
    }

    const row = getTokenWithBatch(db, token);

    if (!row) {
      res.json({ valid: false, reason: 'Token not found' });
      return;
    }

    if (row.status === 'spent') {
      res.json({ valid: false, reason: 'Token already redeemed' });
      return;
    }

    if (row.status === 'revoked') {
      res.json({ valid: false, reason: 'Token revoked' });
      return;
    }

    const now = new Date();
    const expires = new Date(row.expires_at);
    if (now > expires) {
      res.json({ valid: false, reason: 'Token expired' });
      return;
    }

    res.json({
      valid: true,
      expires: row.expires_at,
      promiseType: row.promise_type,
    });
  };
}
