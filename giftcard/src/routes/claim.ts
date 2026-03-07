/**
 * POST /claim — Redeem a gift card claim token.
 *
 * Dispatches to a promise-type-specific handler based on the token's batch.
 * Currently implements 'account-creation'; other types return 501.
 */

import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { GiftcardConfig } from '../config.js';
import { getTokenWithBatch, markTokenSpent, type TokenWithPromise } from '../db.js';
import { isValidUsername } from '../hive/username.js';
import { createAccountFull, isUsernameAvailable, type PublicKeys } from '../hive/account.js';

/**
 * Compute the SHA-256 hash of a token for inclusion in on-chain fulfillment
 * transactions. The hash (not the raw token) is published so that:
 *   - the token remains secret until claimed
 *   - observers can verify fulfillment by hashing a revealed token
 *   - the on-chain account/transfer can be linked back to the batch's merkle root
 */
function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf-8').digest('hex');
}

interface ClaimRequest {
  token: string;
  // For account-creation:
  username?: string;
  keys?: PublicKeys;
  // For future promise types (transfer, delegation, etc.):
  account?: string;
}

export function claimHandler(db: Database.Database, config: GiftcardConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ClaimRequest;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // 1. Validate token is present
    if (!body.token) {
      res.status(400).json({ success: false, error: 'Missing required field: token' });
      return;
    }

    // 2. Look up token with its batch's promise type
    const row = getTokenWithBatch(db, body.token);
    if (!row) {
      console.log(`[CLAIM DENIED] Token not found | IP: ${ip}`);
      res.status(400).json({ success: false, error: 'Invalid token' });
      return;
    }

    if (row.status !== 'active') {
      console.log(`[CLAIM DENIED] Token ${row.status} | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
      res.status(400).json({ success: false, error: `Token ${row.status}` });
      return;
    }

    const now = new Date();
    if (now > new Date(row.expires_at)) {
      console.log(`[CLAIM DENIED] Token expired | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
      res.status(400).json({ success: false, error: 'Token expired' });
      return;
    }

    // 3. Dispatch to promise-type-specific handler
    switch (row.promise_type) {
      case 'account-creation':
        await handleAccountCreation(db, config, body, row, ip, res);
        break;

      default:
        console.log(`[CLAIM DENIED] Unsupported promise type: ${row.promise_type} | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
        res.status(501).json({
          success: false,
          error: `Promise type '${row.promise_type}' is not yet supported`,
        });
    }
  };
}

// -- Promise-type handlers --

/**
 * Handle account-creation claims: validate username + keys, create account,
 * delegate HP, enroll in feed, mark token spent.
 */
async function handleAccountCreation(
  db: Database.Database,
  config: GiftcardConfig,
  body: ClaimRequest,
  row: TokenWithPromise,
  ip: string,
  res: Response,
): Promise<void> {
  // Validate account-creation-specific fields
  if (!body.username || !body.keys) {
    res.status(400).json({ success: false, error: 'Missing required fields: username and keys' });
    return;
  }

  if (!body.keys.owner || !body.keys.active || !body.keys.posting || !body.keys.memo) {
    res.status(400).json({ success: false, error: 'All four public keys required' });
    return;
  }

  // Validate username format
  const usernameError = isValidUsername(body.username);
  if (usernameError) {
    res.status(400).json({ success: false, error: usernameError });
    return;
  }

  // Check username availability on-chain
  try {
    const available = await isUsernameAvailable(config, body.username);
    if (!available) {
      res.status(400).json({ success: false, error: 'Username already taken' });
      return;
    }
  } catch (err) {
    console.error(`[CLAIM ERROR] Username check failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ success: false, error: 'Could not verify username availability' });
    return;
  }

  // Create account, delegate, enroll
  try {
    const result = await createAccountFull(config, body.username, body.keys, tokenHash(body.token));

    // Mark token as spent (even if delegation/enrollment partially failed)
    markTokenSpent(db, body.token, body.username, ip, result.tx_id);

    console.log(
      `[CLAIM OK] @${body.username} | Token: ${body.token.slice(0, 8)}... | ` +
      `TX: ${result.tx_id.slice(0, 12)}... | ` +
      `Delegation: ${result.delegationOk ? 'OK' : 'FAILED'} | ` +
      `Enrollment: ${result.enrollmentOk ? 'OK' : 'FAILED'} | ` +
      `IP: ${ip}`
    );

    res.json({
      success: true,
      account: body.username,
      tx_id: result.tx_id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CLAIM FAILED] @${body.username} | Token: ${body.token.slice(0, 8)}... | Error: ${msg} | IP: ${ip}`);
    res.status(500).json({ success: false, error: 'Account creation failed' });
  }
}
