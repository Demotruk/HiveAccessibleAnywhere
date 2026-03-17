/**
 * Gift card inventory management.
 *
 * Reads card data from the giftcard-generate output directory
 * and loads it into the bot's SQLite database.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { loadCards } from './db.js';

interface ManifestCard {
  tokenPrefix: string;
  pin: string;
  expires: string;
  qrPng: string;
  qrSvg: string;
  invitePdf: string;
  inviteUrl?: string;
}

interface Manifest {
  batchId: string;
  provider: string;
  promiseType: string;
  count: number;
  cards: ManifestCard[];
}

/**
 * Load cards from a batch directory into the database.
 * Returns the number of newly loaded cards (skips duplicates).
 */
export function loadBatch(
  db: Database.Database,
  giftcardOutputDir: string,
  batchId: string,
): { loaded: number; total: number } {
  const batchDir = resolve(giftcardOutputDir, batchId);
  const manifestPath = resolve(batchDir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  const cards: Array<{ tokenPrefix: string; pdfPath: string; inviteUrl?: string }> = [];
  for (const card of manifest.cards) {
    const pdfPath = resolve(batchDir, 'cards', `${card.tokenPrefix}-invite.pdf`);
    if (!existsSync(pdfPath)) {
      console.warn(`PDF not found for ${card.tokenPrefix}, skipping`);
      continue;
    }
    cards.push({ tokenPrefix: card.tokenPrefix, pdfPath, inviteUrl: card.inviteUrl });
  }

  const loaded = loadCards(db, batchId, cards);
  return { loaded, total: manifest.cards.length };
}
