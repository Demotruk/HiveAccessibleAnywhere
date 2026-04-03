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
import { getSigningKey } from '../config.js';
import {
  createIssuerApplication,
  getIssuer,
  listAllIssuers,
  listIssuersByStatus,
  updateIssuerStatus,
  updateIssuerServiceUrl,
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

    const created = createIssuerApplication(
      db,
      username,
      description.trim(),
      contact?.trim(),
      txId,
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
    const issuer = getIssuer(db, username);

    // Derive service public key for delegation check
    let setupStatus: { delegated: boolean; pendingTokens: number } | null = null;

    if (issuer && (issuer.status === 'approved' || issuer.status === 'active')) {
      try {
        const signingKey = getSigningKey(config);
        const servicePublicKey = PrivateKey.from(signingKey).createPublic().toString();
        setupStatus = await getIssuerAccountInfo(username, servicePublicKey, config.hiveNodes);

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

    res.json({
      issuer,
      role: req.role,
      setupStatus,
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

    const now = new Date().toISOString();
    updateIssuerStatus(db, normalized, 'approved', {
      approved_at: now,
      approve_tx_id: txId,
    });

    console.log(`[ISSUER] @${normalized} approved by @${req.issuer}`);

    // Send notification transfer (best-effort, from dedicated notify account)
    if (config.notifyAccount && config.notifyActiveKey) {
      try {
        const dashboardUrl = config.serviceUrl
          ? `${config.serviceUrl.replace(/\/$/, '')}/dashboard/#setup`
          : 'the HiveInvite dashboard';
        const memo = `Your issuer application has been approved! Visit ${dashboardUrl} to complete setup.`;
        await sendApprovalNotification(
          config.notifyAccount,
          config.notifyActiveKey,
          normalized,
          memo,
          config.hiveNodes,
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
