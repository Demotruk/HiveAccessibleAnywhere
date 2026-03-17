/**
 * /load <batch-id> — Load gift cards from a batch directory (operator only).
 */

import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import type { BotConfig } from '../config.js';
import { loadBatch } from '../inventory.js';

export function loadCommand(db: Database.Database, config: BotConfig) {
  return async (ctx: Context) => {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/);
    const batchId = parts[1];

    if (!batchId) {
      await ctx.reply('Usage: /load <batch-id>\n\nExample: /load batch-2026-03-01');
      return;
    }

    try {
      const { loaded, total } = loadBatch(db, config.giftcardOutputDir, batchId);
      await ctx.reply(`Loaded ${loaded} new cards from batch "${batchId}" (${total} total in batch, duplicates skipped).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`Failed to load batch: ${msg}`);
    }
  };
}
