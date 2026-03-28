/**
 * POST /claim — Redeem a gift card claim token.
 *
 * Supports two validation paths:
 * 1. Merkle proof (primary): validates token cryptographically against
 *    on-chain batch declaration — no pre-populated DB needed.
 * 2. DB lookup (fallback): legacy path for tokens without proof data.
 *
 * Dispatches to a promise-type-specific handler based on the token's batch.
 * Currently implements 'account-creation'; other types return 501.
 */

import { createHash } from 'node:crypto';
import { PrivateKey } from 'hive-tx';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { GiftcardConfig } from '../config.js';
import { isMultiTenant } from '../config.js';
import { getTokenWithBatch, markTokenSpent, isTokenSpent, markTokenSpentByHash, type TokenWithPromise } from '../db.js';
import { verifyMerkleProof, verifyCardSignature, decodeMerkleProof } from '../crypto/signing.js';
import { fetchBatchDeclaration } from '../hive/batch-lookup.js';
import { resolveProvider, isProviderAllowed } from '../hive/provider.js';
import { isValidUsername } from '../hive/username.js';
import { createAccountFull, isUsernameAvailable, type PublicKeys, type CreationMethod } from '../hive/account.js';

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
  /** Provider account (multi-tenant). Falls back to config default if absent. */
  provider?: string;
  // Merkle proof validation fields (sent by updated clients):
  batchId?: string;
  signature?: string;
  expires?: string;
  promiseType?: string;
  promiseParams?: Record<string, unknown>;
  merkleProof?: string;
  // For account-creation:
  username?: string;
  keys?: PublicKeys;
  // For future promise types (transfer, delegation, etc.):
  account?: string;
}

/** Which validation path was used */
type ValidationMode = 'merkle' | 'db';

/** Validated token info, common to both paths */
interface ValidatedToken {
  mode: ValidationMode;
  promiseType: string;
  promiseParams: string | null;
  expiresAt: string;
  batchId: string;
  /** Effective provider account (resolved from request or config default) */
  effectiveProvider: string;
  /** Delegation vests override from batch promise_params (if any) */
  delegationVests?: string;
}

export function claimHandler(db: Database.Database, config: GiftcardConfig) {
  // Derive the default provider's public memo key once at startup (single-tenant fallback)
  const defaultMemoPublicKey = PrivateKey.from(config.memoKey).createPublic().toString();

  return async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ClaimRequest;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const reqStart = Date.now();

    // Determine the effective provider account
    const effectiveProvider = body.provider || config.providerAccount;

    console.log(`[CLAIM START] Token: ${body.token?.slice(0, 8) || '(none)'}... | Username: ${body.username || '(none)'} | Provider: @${effectiveProvider} | Mode: ${body.merkleProof ? 'merkle' : 'db'} | IP: ${ip}`);

    // 1. Validate token is present
    if (!body.token) {
      res.status(400).json({ success: false, error: 'Missing required field: token' });
      return;
    }

    // 1b. In multi-tenant mode, check provider is allowed
    if (isMultiTenant(config) && !isProviderAllowed(effectiveProvider, config)) {
      console.log(`[CLAIM DENIED] Provider not allowed: @${effectiveProvider} | IP: ${ip}`);
      res.status(403).json({ success: false, error: 'Provider not authorized' });
      return;
    }

    // 2. Validate token via Merkle proof or DB lookup
    let validated: ValidatedToken;

    if (body.merkleProof && body.batchId && body.signature && body.expires && body.promiseType) {
      // --- Merkle proof path ---
      const hash = tokenHash(body.token);

      // Check double-spend
      if (isTokenSpent(db, hash)) {
        console.log(`[CLAIM DENIED] Token already redeemed (merkle) | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
        res.status(400).json({ success: false, error: 'Token already redeemed' });
        return;
      }

      // Check expiry
      if (new Date() > new Date(body.expires)) {
        console.log(`[CLAIM DENIED] Token expired (merkle) | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
        res.status(400).json({ success: false, error: 'Token expired' });
        return;
      }

      // Fetch batch declaration from the effective provider's account history
      let declaration;
      try {
        console.log(`[CLAIM] Fetching batch declaration: ${body.batchId} from @${effectiveProvider} (${Date.now() - reqStart}ms)`);
        declaration = await fetchBatchDeclaration(effectiveProvider, body.batchId, config.hiveNodes);
        console.log(`[CLAIM] Batch lookup complete: ${declaration ? 'found' : 'not found'} (${Date.now() - reqStart}ms)`);
      } catch (err) {
        console.error(`[CLAIM ERROR] Batch lookup failed after ${Date.now() - reqStart}ms: ${err instanceof Error ? err.message : String(err)}`);
        res.status(500).json({ success: false, error: 'Could not verify batch declaration' });
        return;
      }

      if (!declaration) {
        console.log(`[CLAIM DENIED] Unknown batch: ${body.batchId} on @${effectiveProvider} | IP: ${ip}`);
        res.status(400).json({ success: false, error: 'Unknown batch' });
        return;
      }

      // Verify Merkle proof (decode compact string to steps)
      const proofSteps = decodeMerkleProof(body.merkleProof);
      if (!verifyMerkleProof(hash, proofSteps, declaration.merkleRoot)) {
        console.log(`[CLAIM DENIED] Invalid Merkle proof | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
        res.status(400).json({ success: false, error: 'Invalid token proof' });
        return;
      }

      // Resolve the provider's memo public key for signature verification.
      // In single-tenant mode (no explicit provider), use the pre-derived key.
      // In multi-tenant mode, fetch from chain.
      let memoPublicKey: string;
      if (body.provider && isMultiTenant(config)) {
        try {
          const resolved = await resolveProvider(effectiveProvider, config.hiveNodes);
          memoPublicKey = resolved.memoPublicKey;
        } catch (err) {
          console.error(`[CLAIM ERROR] Provider resolution failed: ${err instanceof Error ? err.message : String(err)}`);
          res.status(500).json({ success: false, error: 'Could not resolve provider' });
          return;
        }
      } else {
        memoPublicKey = defaultMemoPublicKey;
      }

      // Verify signature
      if (!verifyCardSignature(
        body.token, body.batchId, effectiveProvider,
        body.expires, body.promiseType, body.signature, memoPublicKey,
      )) {
        console.log(`[CLAIM DENIED] Invalid signature (merkle) | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
        res.status(400).json({ success: false, error: 'Invalid signature' });
        return;
      }

      // Extract delegation_vests from batch promise_params if present
      const batchDelegationVests = declaration.promiseParams?.delegation_vests as string | undefined;

      validated = {
        mode: 'merkle',
        promiseType: body.promiseType,
        promiseParams: body.promiseParams ? JSON.stringify(body.promiseParams) : null,
        expiresAt: body.expires,
        batchId: body.batchId,
        effectiveProvider,
        delegationVests: batchDelegationVests,
      };
    } else {
      // --- DB lookup fallback ---
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

      if (new Date() > new Date(row.expires_at)) {
        console.log(`[CLAIM DENIED] Token expired | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
        res.status(400).json({ success: false, error: 'Token expired' });
        return;
      }

      validated = {
        mode: 'db',
        promiseType: row.promise_type,
        promiseParams: row.promise_params,
        expiresAt: row.expires_at,
        batchId: row.batch_id,
        effectiveProvider,
      };
    }

    // 3. Dispatch to promise-type-specific handler
    switch (validated.promiseType) {
      case 'account-creation':
        await handleAccountCreation(db, config, body, validated, ip, res, reqStart);
        break;

      default:
        console.log(`[CLAIM DENIED] Unsupported promise type: ${validated.promiseType} | Token: ${body.token.slice(0, 8)}... | IP: ${ip}`);
        res.status(501).json({
          success: false,
          error: `Promise type '${validated.promiseType}' is not yet supported`,
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
  validated: ValidatedToken,
  ip: string,
  res: Response,
  reqStart: number,
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
  const usernameStart = Date.now();
  console.log(`[CLAIM] Checking username availability: @${body.username} (${usernameStart - reqStart}ms)`);
  try {
    const available = await isUsernameAvailable(config, body.username);
    console.log(`[CLAIM] Username check complete: ${available ? 'available' : 'taken'} (${Date.now() - reqStart}ms)`);
    if (!available) {
      res.status(400).json({ success: false, error: 'Username already taken' });
      return;
    }
  } catch (err) {
    console.error(`[CLAIM ERROR] Username check failed after ${Date.now() - reqStart}ms: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ success: false, error: 'Could not verify username availability' });
    return;
  }

  // Create account and delegate
  try {
    const hash = tokenHash(body.token);
    // In multi-tenant mode, pass the effective provider and per-batch delegation amount
    const providerOverride = validated.effectiveProvider !== config.providerAccount
      ? validated.effectiveProvider : undefined;
    console.log(`[CLAIM] Creating account @${body.username} by @${validated.effectiveProvider} (${Date.now() - reqStart}ms)`);
    const result = await createAccountFull(
      config, body.username, body.keys, hash,
      providerOverride, validated.delegationVests,
    );

    // Mark token as spent using the appropriate method
    if (validated.mode === 'merkle') {
      markTokenSpentByHash(db, hash, validated.batchId, body.username, ip, result.tx_id, validated.effectiveProvider);
    } else {
      markTokenSpent(db, body.token, body.username, ip, result.tx_id);
    }

    console.log(
      `[CLAIM OK] @${body.username} | Token: ${body.token.slice(0, 8)}... | ` +
      `Mode: ${validated.mode} | Method: ${result.method} | ` +
      `TX: ${result.tx_id.slice(0, 12)}... | ` +
      `Delegation: ${result.delegationOk ? 'OK' : 'FAILED'} | ` +
      `IP: ${ip}`
    );

    res.json({
      success: true,
      account: body.username,
      tx_id: result.tx_id,
      method: result.method,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CLAIM FAILED] @${body.username} | Token: ${body.token.slice(0, 8)}... | Error: ${msg} | IP: ${ip}`);
    res.status(500).json({ success: false, error: 'Account creation failed' });
  }
}
