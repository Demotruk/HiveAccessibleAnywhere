/**
 * Allocation routes: admin assigns cards from an allocatable batch to a
 * recipient issuer, and recipients view / print their allocated cards.
 *
 * The cards always remain attributed to the batch's original provider
 * (the operator) — allocation is a distribution mechanism, not a transfer
 * of ownership. The printed card and QR claim flow show the operator as
 * the issuer.
 */

import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { PDFDocument } from 'pdf-lib';
import {
  getIssuer,
  getAllocatableBatchByIdForProvider,
  allocateFromBatch,
  listAllocationSummariesForRecipient,
  listAllocatedCardsForRecipient,
  getAllocatedTokenIndicesInBatch,
  getBatchPdfRaw,
} from '../db.js';

const MAX_ALLOCATE_PER_REQUEST = 100;

/**
 * POST /api/admin/batches/:id/allocate
 * Allocate `count` cards from the operator's allocatable batch to `to`.
 */
export function allocateBatchHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const operator = req.issuer!;
    const batchId = req.params.id as string;
    const body = req.body as { to?: string; count?: number };

    const recipient = body.to?.toLowerCase().trim().replace(/^@/, '');
    if (!recipient) {
      res.status(400).json({ error: 'Missing recipient (to)' });
      return;
    }

    const count = body.count;
    if (!count || typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_ALLOCATE_PER_REQUEST) {
      res.status(400).json({ error: `count must be an integer between 1 and ${MAX_ALLOCATE_PER_REQUEST}` });
      return;
    }

    if (recipient === operator) {
      res.status(400).json({ error: 'Cannot allocate to yourself' });
      return;
    }

    const batch = getAllocatableBatchByIdForProvider(db, batchId, operator);
    if (!batch) {
      res.status(404).json({ error: 'Allocatable batch not found' });
      return;
    }

    const recipientRow = getIssuer(db, recipient);
    if (!recipientRow) {
      res.status(404).json({ error: `No issuer record for @${recipient}` });
      return;
    }
    if (recipientRow.status === 'banned') {
      res.status(400).json({ error: `@${recipient} is banned` });
      return;
    }

    const allocated = allocateFromBatch(db, batchId, recipient, count);
    if (allocated < count) {
      console.warn(`[ALLOC] @${operator} requested ${count} from ${batchId} for @${recipient}; only ${allocated} available`);
    } else {
      console.log(`[ALLOC] @${operator} allocated ${allocated} cards from ${batchId} to @${recipient}`);
    }

    res.json({ allocated, requested: count, batchId, recipient });
  };
}

/**
 * GET /api/allocations/me
 * List the authenticated user's allocations, grouped by source batch.
 */
export function listMyAllocationsHandler(db: Database.Database) {
  return (req: Request, res: Response): void => {
    const me = req.issuer!;
    const summaries = listAllocationSummariesForRecipient(db, me);
    const cards = listAllocatedCardsForRecipient(db, me).map(c => ({
      tokenPrefix: c.token.slice(0, 8),
      batchId: c.batch_id,
      batchProvider: c.batch_provider,
      status: c.status,
      claimedBy: c.claimed_by,
      claimedAt: c.claimed_at,
      expiresAt: c.expires_at,
    }));
    res.json({ batches: summaries, cards });
  };
}

/**
 * GET /api/allocations/me/pdf?batch=:id[&include=all|unclaimed]
 * Generate a subset PDF on-demand by copying matching pages from the
 * source batch's stored combined PDF.
 */
export function downloadMyAllocationPdfHandler(db: Database.Database) {
  return async (req: Request, res: Response): Promise<void> => {
    const me = req.issuer!;
    const batchId = req.query.batch as string | undefined;
    if (!batchId) {
      res.status(400).json({ error: 'Missing batch query parameter' });
      return;
    }
    const include = (req.query.include as string | undefined) ?? 'unclaimed';
    const unclaimedOnly = include !== 'all';

    const indices = getAllocatedTokenIndicesInBatch(db, me, batchId, { unclaimedOnly });
    if (indices.length === 0) {
      res.status(404).json({ error: 'No allocated cards to print' });
      return;
    }

    const sourcePdfBuf = getBatchPdfRaw(db, batchId);
    if (!sourcePdfBuf) {
      res.status(404).json({ error: 'Source batch PDF not found' });
      return;
    }

    try {
      const srcDoc = await PDFDocument.load(sourcePdfBuf);
      const totalPages = srcDoc.getPageCount();
      const out = await PDFDocument.create();

      // Each card is 2 pages (front, back) at indices 2N, 2N+1.
      const pageIndices: number[] = [];
      for (const i of indices) {
        const front = i * 2;
        const back = i * 2 + 1;
        if (front < totalPages) pageIndices.push(front);
        if (back < totalPages) pageIndices.push(back);
      }

      const copied = await out.copyPages(srcDoc, pageIndices);
      for (const p of copied) out.addPage(p);

      const bytes = await out.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${batchId}-allocated-${me}.pdf"`);
      res.send(Buffer.from(bytes));
    } catch (err) {
      console.error(`[ALLOC PDF] Failed for @${me} batch ${batchId}:`, err instanceof Error ? err.message : String(err));
      res.status(500).json({ error: 'Failed to render allocation PDF' });
    }
  };
}
