/**
 * POST /validate — Pre-flight token validation.
 *
 * The wallet calls this before showing the username selection screen,
 * to confirm the token is still valid before proceeding.
 *
 * Supports two validation paths:
 * 1. Merkle proof (primary): validates against on-chain batch declaration.
 * 2. DB lookup (fallback): for tokens without proof data.
 */

import { createHash } from 'node:crypto';
import { PrivateKey } from 'hive-tx';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { GiftcardConfig } from '../config.js';
import { isMultiTenant } from '../config.js';
import { getTokenWithBatch, isTokenSpent } from '../db.js';
import { verifyMerkleProof, verifyCardSignature, decodeMerkleProof } from '../crypto/signing.js';
import { fetchBatchDeclaration } from '../hive/batch-lookup.js';
import { resolveProvider, isProviderAllowed } from '../hive/provider.js';

interface ValidateRequest {
  token: string;
  /** Provider account (multi-tenant). Falls back to config default if absent. */
  provider?: string;
  batchId?: string;
  signature?: string;
  expires?: string;
  promiseType?: string;
  merkleProof?: string;
}

export function validateHandler(db: Database.Database, config: GiftcardConfig) {
  const defaultMemoPublicKey = config.memoKey
    ? PrivateKey.from(config.memoKey).createPublic().toString()
    : null;

  return async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ValidateRequest;
    const reqStart = Date.now();

    const effectiveProvider = body.provider || config.providerAccount;

    console.log(`[VALIDATE] Token: ${body.token?.slice(0, 8) || '(none)'}... | Provider: @${effectiveProvider} | Mode: ${body.merkleProof ? 'merkle' : 'db'}`);

    if (!body.token || typeof body.token !== 'string') {
      res.status(400).json({ valid: false, reason: 'Missing token' });
      return;
    }

    // In multi-tenant mode, check provider is allowed
    if (isMultiTenant(config) && !isProviderAllowed(effectiveProvider, config)) {
      res.status(403).json({ valid: false, reason: 'Provider not authorized' });
      return;
    }

    if (body.merkleProof && body.batchId && body.signature && body.expires && body.promiseType) {
      // --- Merkle proof path ---
      const hash = createHash('sha256').update(body.token, 'utf-8').digest('hex');

      if (isTokenSpent(db, hash)) {
        res.json({ valid: false, reason: 'Token already redeemed' });
        return;
      }

      if (new Date() > new Date(body.expires)) {
        res.json({ valid: false, reason: 'Token expired' });
        return;
      }

      let declaration;
      try {
        console.log(`[VALIDATE] Fetching batch declaration: ${body.batchId} from @${effectiveProvider} (${Date.now() - reqStart}ms)`);
        declaration = await fetchBatchDeclaration(effectiveProvider, body.batchId, config.hiveNodes);
        console.log(`[VALIDATE] Batch lookup complete: ${declaration ? 'found' : 'not found'} (${Date.now() - reqStart}ms)`);
      } catch (err) {
        console.error(`[VALIDATE ERROR] Batch lookup failed after ${Date.now() - reqStart}ms: ${err instanceof Error ? err.message : String(err)}`);
        res.status(500).json({ valid: false, reason: 'Could not verify batch declaration' });
        return;
      }

      if (!declaration) {
        res.json({ valid: false, reason: 'Unknown batch' });
        return;
      }

      const proofSteps = decodeMerkleProof(body.merkleProof);
      if (!verifyMerkleProof(hash, proofSteps, declaration.merkleRoot)) {
        res.json({ valid: false, reason: 'Invalid token proof' });
        return;
      }

      // Resolve memo public key for signature verification.
      // In multi-tenant mode, cards are signed with the service account's memo key.
      // In single-tenant mode, use the provider's pre-derived key.
      let memoPublicKey: string;
      if (isMultiTenant(config)) {
        try {
          const resolved = await resolveProvider(config.serviceAccount!, config.hiveNodes);
          memoPublicKey = resolved.memoPublicKey;
        } catch (err) {
          console.error(`[VALIDATE ERROR] Service account memo key resolution failed: ${err instanceof Error ? err.message : String(err)}`);
          res.status(500).json({ valid: false, reason: 'Could not resolve service account' });
          return;
        }
      } else if (defaultMemoPublicKey) {
        memoPublicKey = defaultMemoPublicKey;
      } else {
        res.status(500).json({ valid: false, reason: 'No memo key configured' });
        return;
      }

      if (!verifyCardSignature(
        body.token, body.batchId, effectiveProvider,
        body.expires, body.promiseType, body.signature, memoPublicKey,
      )) {
        res.json({ valid: false, reason: 'Invalid signature' });
        return;
      }

      res.json({
        valid: true,
        expires: body.expires,
        promiseType: body.promiseType,
      });
    } else {
      // --- DB lookup fallback ---
      const row = getTokenWithBatch(db, body.token);

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
    }
  };
}
