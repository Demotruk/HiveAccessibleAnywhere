/**
 * Issuer management API routes.
 *
 * Handles issuer applications (any authenticated user) and
 * admin operations (approve, list issuers).
 */

import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { PrivateKey } from 'hive-tx';
import type { GiftcardConfig } from '../config.js';
import { getSigningKey, isPreapproved } from '../config.js';
import {
  createIssuerApplication,
  createPreapprovedIssuer,
  getIssuer,
  listAllIssuers,
  listIssuersByStatus,
  updateIssuerStatus,
  updateIssuerServiceUrl,
  revokeIssuer,
  banIssuer,
} from '../db.js';
import { getIssuerAccountInfo, sendApprovalNotification } from '../hive/issuer-ops.js';

// -- Application routes (any authenticated user) --

/**
 * POST /api/issuers/apply
 * Submit an issuer application. Idempotent — returns existing record if already applied.
 */
export function applyHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const username = req.issuer!;
    const { description, contact, txId } = req.body as {
      description?: string;
      contact?: string;
      txId?: string;
    };

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ error: 'Description is required' });
      return;
    }

    // Check if already applied
    const existing = getIssuer(db, username);
    if (existing) {
      if (existing.status === 'active') {
        res.status(400).json({ error: 'Already an active issuer' });
        return;
      }
      // Return existing application
      res.json({ issuer: existing });
      return;
    }

    // txId may arrive as an object from Keychain ({id, tx_id}) — normalize to string
    const normalizedTxId = typeof txId === 'object' && txId !== null
      ? (txId as Record<string, unknown>).tx_id as string ?? (txId as Record<string, unknown>).id as string ?? undefined
      : txId;

    const created = createIssuerApplication(
      db,
      username,
      description.trim(),
      contact?.trim(),
      normalizedTxId,
    );

    if (!created) {
      // Race condition fallback
      const record = getIssuer(db, username);
      res.json({ issuer: record });
      return;
    }

    const record = getIssuer(db, username);
    console.log(`[ISSUER] New application from @${username}`);
    res.status(201).json({ issuer: record });
  };
}

/**
 * GET /api/issuers/me
 * Get the authenticated user's issuer record and on-chain setup status.
 */
export function meHandler(db: Database.Database, config: GiftcardConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    const username = req.issuer!;
    let issuer = getIssuer(db, username);
    let preApproved = false;

    // Auto-create approved record for pre-approved issuers on first login
    if (!issuer && isPreapproved(config, username)) {
      createPreapprovedIssuer(db, username);
      issuer = getIssuer(db, username);
      preApproved = true;
      console.log(`[ISSUER] @${username} auto-approved (pre-approved list)`);
    }

    // Derive service public key for delegation check
    let setupStatus: { delegated: boolean; pendingTokens: number; serviceAccount?: string; operatorAccount?: string } | null = null;

    if (issuer && (issuer.status === 'approved' || issuer.status === 'active')) {
      try {
        const signingKey = getSigningKey(config);
        const servicePublicKey = PrivateKey.from(signingKey).createPublic().toString();
        setupStatus = await getIssuerAccountInfo(username, servicePublicKey, config.serviceAccount, config.hiveNodes);
        setupStatus.serviceAccount = config.serviceAccount || config.providerAccount;
        setupStatus.operatorAccount = config.providerAccount;

        // Auto-transition: approved → active once delegation is verified
        if (issuer.status === 'approved' && setupStatus.delegated) {
          updateIssuerStatus(db, username, 'active', {
            delegation_verified_at: new Date().toISOString(),
          });
          issuer.status = 'active';
          issuer.delegation_verified_at = new Date().toISOString();
          console.log(`[ISSUER] @${username} auto-activated (delegation verified)`);
        }
      } catch (err) {
        console.warn(`[ISSUER] Could not fetch setup status for @${username}:`, err instanceof Error ? err.message : String(err));
      }
    }

    // Recompute role if the issuer was just auto-activated — req.role was set by
    // middleware before the handler ran and may be stale ('applicant' instead of 'issuer').
    let role = req.role;
    if (issuer?.status === 'active' && role === 'applicant') {
      role = 'issuer';
    }

    res.json({
      issuer,
      role,
      setupStatus,
      ...(preApproved && { preApproved: true }),
    });
  };
}

/**
 * POST /api/issuers/me/service-url
 * Set or update the authenticated issuer's external gift card service URL.
 * If the issuer is 'approved' and provides a valid URL, auto-transitions to 'active'.
 * Send `{ serviceUrl: null }` to clear the external URL.
 */
export function setServiceUrlHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const username = req.issuer!;
    const { serviceUrl } = req.body as { serviceUrl?: string | null };

    // Validate: must be null (clear) or a valid HTTPS URL
    if (serviceUrl !== null && serviceUrl !== undefined) {
      if (typeof serviceUrl !== 'string' || serviceUrl.trim().length === 0) {
        res.status(400).json({ error: 'serviceUrl must be a non-empty string or null' });
        return;
      }
      try {
        const parsed = new URL(serviceUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          res.status(400).json({ error: 'serviceUrl must use HTTPS (or HTTP for local development)' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'serviceUrl must be a valid URL' });
        return;
      }
    }

    const issuer = getIssuer(db, username);
    if (!issuer) {
      res.status(404).json({ error: 'No issuer record found' });
      return;
    }

    if (issuer.status === 'pending') {
      res.status(400).json({ error: 'Application must be approved before configuring a service URL' });
      return;
    }

    const url = serviceUrl?.trim() ?? null;
    updateIssuerServiceUrl(db, username, url);

    // Auto-transition: approved → active when a service URL is set
    if (issuer.status === 'approved' && url) {
      updateIssuerStatus(db, username, 'active', {
        delegation_verified_at: new Date().toISOString(),
      });
      console.log(`[ISSUER] @${username} auto-activated (external service URL registered)`);
    }

    const updated = getIssuer(db, username);
    res.json({ issuer: updated });
  };
}

// -- Admin routes --

/**
 * GET /api/admin/issuers
 * List all issuers, optionally filtered by status.
 */
export function listIssuersHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const status = req.query.status as string | undefined;

    if (status) {
      const issuers = listIssuersByStatus(db, status);
      res.json({ issuers });
    } else {
      const issuers = listAllIssuers(db);
      res.json({ issuers });
    }
  };
}

/**
 * POST /api/admin/issuers/:username/approve
 * Approve a pending issuer application.
 */
export function approveHandler(db: Database.Database, config: GiftcardConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    const username = req.params.username as string;
    const { txId } = req.body as { txId?: string };

    if (!username) {
      res.status(400).json({ error: 'Missing username' });
      return;
    }

    const normalized = username.toLowerCase().trim();
    const issuer = getIssuer(db, normalized);

    if (!issuer) {
      res.status(404).json({ error: 'Issuer application not found' });
      return;
    }

    if (issuer.status !== 'pending') {
      res.status(400).json({ error: `Issuer is already ${issuer.status}` });
      return;
    }

    // txId may arrive as an object from Keychain — normalize to string
    const normalizedTxId = typeof txId === 'object' && txId !== null
      ? (txId as Record<string, unknown>).tx_id as string ?? (txId as Record<string, unknown>).id as string ?? undefined
      : txId;

    const now = new Date().toISOString();
    updateIssuerStatus(db, normalized, 'approved', {
      approved_at: now,
      approve_tx_id: normalizedTxId,
    });

    console.log(`[ISSUER] @${normalized} approved by @${req.issuer}`);

    // Send notification transfer (best-effort, from dedicated notify account)
    if (!config.notifyAccount || !config.notifyActiveKey) {
      console.log(`[ISSUER] Notification skipped for @${normalized}: GIFTCARD_NOTIFY_ACCOUNT/GIFTCARD_NOTIFY_ACTIVE_KEY not configured`);
    } else {
      try {
        const dashboardUrl = config.dashboardUrl
          ? `${config.dashboardUrl.replace(/\/$/, '')}/#setup`
          : 'the HiveInvite dashboard';
        const memo = `Your issuer application has been approved! Visit ${dashboardUrl} to complete setup.`;
        await sendApprovalNotification(
          config.notifyAccount,
          config.notifyActiveKey,
          normalized,
          memo,
          config.hiveNodes,
          config.notifyCurrency,
        );
        console.log(`[ISSUER] Notification sent to @${normalized} from @${config.notifyAccount}`);
      } catch (err) {
        console.warn(`[ISSUER] Notification to @${normalized} failed:`, err instanceof Error ? err.message : String(err));
      }
    }

    const updated = getIssuer(db, normalized);
    res.json({ issuer: updated });
  };
}

/**
 * POST /api/admin/issuers/:username/revoke
 * Revoke an approved or active issuer's authorization.
 */
export function revokeHandler(db: Database.Database, config: GiftcardConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    const username = req.params.username as string;

    if (!username) {
      res.status(400).json({ error: 'Missing username' });
      return;
    }

    const normalized = username.toLowerCase().trim();
    const issuer = getIssuer(db, normalized);

    if (!issuer) {
      res.status(404).json({ error: 'Issuer not found' });
      return;
    }

    if (issuer.status !== 'approved' && issuer.status !== 'active') {
      res.status(400).json({ error: `Cannot revoke issuer with status '${issuer.status}'` });
      return;
    }

    const revoked = revokeIssuer(db, normalized, req.issuer!);
    if (!revoked) {
      res.status(500).json({ error: 'Failed to revoke issuer' });
      return;
    }

    console.log(`[ISSUER] @${normalized} revoked by @${req.issuer}`);

    // Send notification transfer (best-effort)
    if (!config.notifyAccount || !config.notifyActiveKey) {
      console.log(`[ISSUER] Revocation notification skipped for @${normalized}: GIFTCARD_NOTIFY_ACCOUNT/GIFTCARD_NOTIFY_ACTIVE_KEY not configured`);
    } else {
      try {
        const memo = 'Your issuer authorization has been revoked. Contact us to discuss.';
        await sendApprovalNotification(
          config.notifyAccount,
          config.notifyActiveKey,
          normalized,
          memo,
          config.hiveNodes,
          config.notifyCurrency,
        );
        console.log(`[ISSUER] Revocation notification sent to @${normalized} from @${config.notifyAccount}`);
      } catch (err) {
        console.warn(`[ISSUER] Revocation notification to @${normalized} failed:`, err instanceof Error ? err.message : String(err));
      }
    }

    const updated = getIssuer(db, normalized);
    res.json({ issuer: updated });
  };
}

/**
 * POST /api/admin/issuers/:username/ban
 * Ban an issuer. Blocks dashboard access AND card redemption.
 */
export function banHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const username = req.params.username as string;

    if (!username) {
      res.status(400).json({ error: 'Missing username' });
      return;
    }

    const normalized = username.toLowerCase().trim();
    const issuer = getIssuer(db, normalized);

    if (!issuer) {
      res.status(404).json({ error: 'Issuer not found' });
      return;
    }

    if (issuer.status === 'pending' || issuer.status === 'banned') {
      res.status(400).json({ error: `Cannot ban issuer with status '${issuer.status}'` });
      return;
    }

    const banned = banIssuer(db, normalized, req.issuer!);
    if (!banned) {
      res.status(500).json({ error: 'Failed to ban issuer' });
      return;
    }

    console.log(`[ISSUER] @${normalized} banned by @${req.issuer}`);

    const updated = getIssuer(db, normalized);
    res.json({ issuer: updated });
  };
}
