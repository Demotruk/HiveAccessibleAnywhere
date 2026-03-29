/**
 * Dashboard API routes for batch management.
 *
 * All routes require JWT authentication via the requireAuth middleware.
 * The authenticated issuer's username is available as req.issuer.
 */

import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { GiftcardConfig } from '../config.js';
import {
  listBatchesByProvider,
  getBatchByIdForProvider,
  getBatchPdf,
  getBatchManifest,
  listTokens,
} from '../db.js';
import { generateBatch, type BatchGenerateOptions } from '../generate/batch.js';

const VALID_LOCALES = new Set(['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi']);

/**
 * POST /api/batches — Generate a new batch of gift cards.
 */
export function createBatchHandler(db: Database.Database, config: GiftcardConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    const issuer = req.issuer!;
    const body = req.body as {
      count?: number;
      expiryDays?: number;
      design?: string;
      locale?: string;
      variant?: 'standard' | 'robust';
      distribute?: boolean;
      note?: string;
    };

    // Validate count
    const count = body.count;
    if (!count || typeof count !== 'number' || count < 1 || count > 100 || !Number.isInteger(count)) {
      res.status(400).json({ error: 'count must be an integer between 1 and 100' });
      return;
    }

    // Validate locale
    const locale = body.locale ?? 'en';
    if (!VALID_LOCALES.has(locale)) {
      res.status(400).json({ error: `Invalid locale. Must be one of: ${[...VALID_LOCALES].join(', ')}` });
      return;
    }

    // Validate design
    const design = body.design ?? 'hive';
    if (design !== 'hive') {
      res.status(400).json({ error: 'Only "hive" design is supported in v1' });
      return;
    }

    const options: BatchGenerateOptions = {
      count,
      expiryDays: body.expiryDays ?? 365,
      design,
      locale,
      variant: body.variant ?? 'standard',
      note: body.note,
    };

    try {
      const result = await generateBatch(db, config, issuer, options);
      res.json({
        ...result,
        downloads: {
          pdf: `/api/batches/${result.batchId}/pdf`,
          manifest: `/api/batches/${result.batchId}/manifest`,
        },
      });
    } catch (err) {
      console.error(`[BATCH API] Generation failed for @${issuer}:`, err instanceof Error ? err.message : String(err));
      res.status(500).json({ error: err instanceof Error ? err.message : 'Batch generation failed' });
    }
  };
}

/**
 * GET /api/batches — List all batches for the authenticated issuer.
 */
export function listBatchesHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const issuer = req.issuer!;
    const batches = listBatchesByProvider(db, issuer);

    const result = batches.map(batch => {
      const tokens = listTokens(db, batch.id);
      const active = tokens.filter(t => t.status === 'active').length;
      const spent = tokens.filter(t => t.status === 'spent').length;
      const revoked = tokens.filter(t => t.status === 'revoked').length;

      return {
        batchId: batch.id,
        createdAt: batch.created_at,
        expiresAt: batch.expires_at,
        count: batch.count,
        promiseType: batch.promise_type,
        declarationTx: batch.declaration_tx,
        merkleRoot: batch.merkle_root,
        note: batch.note,
        status: { active, spent, revoked },
      };
    });

    res.json({ batches: result });
  };
}

/**
 * GET /api/batches/:id — Batch detail with per-card status.
 */
export function getBatchDetailHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const issuer = req.issuer!;
    const batchId = req.params.id;

    const batch = getBatchByIdForProvider(db, batchId, issuer);
    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    const tokens = listTokens(db, batchId);
    const cards = tokens.map(t => ({
      tokenPrefix: t.token.slice(0, 8),
      status: t.status,
      claimedBy: t.claimed_by,
      claimedAt: t.claimed_at,
    }));

    res.json({
      batchId: batch.id,
      createdAt: batch.created_at,
      expiresAt: batch.expires_at,
      count: batch.count,
      promiseType: batch.promise_type,
      declarationTx: batch.declaration_tx,
      merkleRoot: batch.merkle_root,
      note: batch.note,
      cards,
    });
  };
}

/**
 * GET /api/batches/:id/pdf — Download combined PDF for a batch.
 */
export function downloadPdfHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const issuer = req.issuer!;
    const batchId = req.params.id;

    const pdfData = getBatchPdf(db, batchId, issuer);
    if (!pdfData) {
      res.status(404).json({ error: 'PDF not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${batchId}.pdf"`);
    res.send(pdfData);
  };
}

/**
 * GET /api/batches/:id/manifest — Download manifest JSON for a batch.
 */
export function downloadManifestHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const issuer = req.issuer!;
    const batchId = req.params.id;

    const manifestData = getBatchManifest(db, batchId, issuer);
    if (!manifestData) {
      res.status(404).json({ error: 'Manifest not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${batchId}-manifest.json"`);
    res.send(manifestData);
  };
}
