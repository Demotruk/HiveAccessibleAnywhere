/**
 * Server-side gift card batch generation pipeline.
 *
 * Adapts the logic from scripts/giftcard-generate.ts to run as part of the
 * giftcard service API, with all output stored in SQLite rather than the filesystem.
 */

import { randomBytes } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import type Database from 'better-sqlite3';
import type { GiftcardConfig } from '../config.js';
import { isMultiTenant, getSigningKey } from '../config.js';
import {
  generateToken,
  generatePin,
  signCardData,
  merkleRoot,
  generateMerkleProof,
  encodeMerkleProof,
  encryptPayload,
  type GiftCardPayload,
} from '../crypto/signing.js';
import {
  createBatchWithProvider,
  insertToken,
  updateBatchDeclaration,
  updateBatchArtifacts,
} from '../db.js';
import { declareOnChain } from './declare.js';
import { loadDesign } from './design-loader.js';
import { generateInvitePdf } from './pdf.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchGenerateOptions {
  count: number;
  expiryDays?: number;
  design?: string;
  locale?: string;
  variant?: 'standard' | 'robust';
  promiseType?: string;
  promiseParams?: Record<string, unknown>;
  note?: string;
  /** Hive usernames the new account will auto-follow on creation (max 20) */
  autoFollow?: string[];
  /** Hive communities to subscribe the new account to on creation (max 10) */
  communities?: string[];
  /** Hive username to record as account referrer */
  referrer?: string;
  /** Skip on-chain declaration (for testing) */
  skipOnChain?: boolean;
}

export interface BatchResult {
  batchId: string;
  count: number;
  expiresAt: string;
  merkleRoot: string;
  declarationTx: string | null;
}

const MAX_BATCH_SIZE = 100;
const VALID_LOCALES = new Set(['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi']);

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Generate a complete gift card batch: tokens, PDFs, on-chain declaration.
 * All artifacts are stored in SQLite (no filesystem writes).
 */
export async function generateBatch(
  db: Database.Database,
  config: GiftcardConfig,
  issuer: string,
  options: BatchGenerateOptions,
): Promise<BatchResult> {
  const {
    count,
    expiryDays = 365,
    design: designName = 'hive',
    locale = 'en',
    variant = 'standard',
    promiseType = 'account-creation',
    promiseParams,
    note,
    autoFollow,
    communities,
    referrer,
    skipOnChain = false,
  } = options;

  // -- Validate --
  if (count < 1 || count > MAX_BATCH_SIZE) {
    throw new Error(`Batch size must be between 1 and ${MAX_BATCH_SIZE}`);
  }
  if (!VALID_LOCALES.has(locale)) {
    throw new Error(`Invalid locale "${locale}". Must be one of: ${[...VALID_LOCALES].join(', ')}`);
  }

  // -- Resolve signing key --
  // In multi-tenant mode, use the service memo key for card signing.
  // In single-tenant mode, use the provider's memo key.
  const memoKeyWif = isMultiTenant(config) ? config.serviceMemoKey! : config.memoKey;
  if (!memoKeyWif) {
    throw new Error('No memo key available for card signing');
  }

  // -- Generate batch ID and expiry --
  const batchId = `batch-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
  const expiryDateStr = expiresAt.split('T')[0]; // YYYY-MM-DD for display

  console.log(`[BATCH] Generating ${count} cards for @${issuer} (batch: ${batchId})`);

  // -- Step 1: Generate tokens + PINs + signatures --
  const cards: Array<{ token: string; pin: string; signature: string }> = [];
  for (let i = 0; i < count; i++) {
    const token = generateToken();
    const pin = generatePin();
    const signature = signCardData(token, batchId, issuer, expiresAt, promiseType, memoKeyWif);
    cards.push({ token, pin, signature });
  }

  // -- Step 2: Compute Merkle root --
  const tokens = cards.map(c => c.token);
  const root = merkleRoot(tokens);
  console.log(`[BATCH] Merkle root: ${root}`);

  // -- Step 3: Write to database --
  createBatchWithProvider(db, batchId, expiresAt, count, issuer, root, undefined, note, promiseType, promiseParams);
  for (const card of cards) {
    insertToken(db, card.token, batchId, card.pin, card.signature, expiresAt);
  }

  // -- Step 4: On-chain declaration --
  let declarationTx: string | null = null;
  if (!skipOnChain) {
    try {
      const activeKeyWif = getSigningKey(config);
      declarationTx = await declareOnChain(
        issuer, activeKeyWif, batchId, count, expiresAt, root, promiseType, promiseParams,
      );
      updateBatchDeclaration(db, batchId, declarationTx);
      console.log(`[BATCH] On-chain declaration: ${declarationTx}`);
    } catch (err) {
      console.error(`[BATCH] On-chain declaration failed: ${err instanceof Error ? err.message : String(err)}`);
      // Continue — batch is usable via DB lookup fallback path
    }
  }

  // -- Step 5: Generate QR codes + PDFs --
  const resolvedDesign = loadDesign(designName);
  const bootstrapUrl = 'https://hiveinvite.com';
  const serviceUrl = config.serviceUrl
    || `https://haa-giftcard-${config.serviceAccount || config.providerAccount}.fly.dev`;

  const individualPdfs: Uint8Array[] = [];
  const manifestCards: Array<{
    tokenPrefix: string;
    pin: string;
    expires: string;
    inviteUrl: string;
  }> = [];

  for (const card of cards) {
    // Build encrypted payload
    const proof = generateMerkleProof(tokens, card.token);
    const payload: GiftCardPayload = {
      token: card.token,
      provider: issuer,
      serviceUrl,
      endpoints: [],
      batchId,
      expires: expiresAt,
      signature: card.signature,
      promiseType,
      promiseParams,
      merkleProof: encodeMerkleProof(proof),
      variant,
      locale: variant === 'robust' ? locale : undefined,
      autoFollow: autoFollow?.length ? autoFollow : undefined,
      communities: communities?.length ? communities : undefined,
      referrer: referrer || undefined,
    };

    const encryptedBlob = encryptPayload(payload, card.pin);
    const qrUrl = `${bootstrapUrl}/invite/#${encryptedBlob}`;

    // Generate QR code PNG
    const qrPngBuffer = await QRCode.toBuffer(qrUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 512,
    });

    // Generate invite PDF
    const pdfBytes = await generateInvitePdf({
      qrPngBytes: new Uint8Array(qrPngBuffer),
      pin: card.pin,
      issuer,
      expires: expiryDateStr,
      locale,
      variant,
      design: resolvedDesign,
    });

    individualPdfs.push(pdfBytes);

    manifestCards.push({
      tokenPrefix: card.token.slice(0, 8),
      pin: card.pin,
      expires: expiresAt,
      inviteUrl: qrUrl,
    });
  }

  // -- Step 6: Merge PDFs --
  const combinedPdf = await PDFDocument.create();
  for (const pdfBytes of individualPdfs) {
    const srcDoc = await PDFDocument.load(pdfBytes);
    const pages = await combinedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const page of pages) {
      combinedPdf.addPage(page);
    }
  }
  const combinedPdfBytes = await combinedPdf.save();

  // -- Step 7: Build manifest --
  const manifest = {
    batchId,
    provider: issuer,
    variant,
    locale,
    design: designName,
    promiseType,
    promiseParams: promiseParams ?? null,
    autoFollow: autoFollow?.length ? autoFollow : null,
    communities: communities?.length ? communities : null,
    referrer: referrer ?? null,
    count,
    createdAt: new Date().toISOString(),
    expiresAt,
    merkleRoot: root,
    declarationTx,
    cards: manifestCards,
  };

  // -- Step 8: Store artifacts in DB --
  updateBatchArtifacts(db, batchId, Buffer.from(combinedPdfBytes), JSON.stringify(manifest, null, 2));

  console.log(`[BATCH] Complete: ${count} cards, ${combinedPdfBytes.length} bytes PDF`);

  return {
    batchId,
    count,
    expiresAt,
    merkleRoot: root,
    declarationTx,
  };
}
