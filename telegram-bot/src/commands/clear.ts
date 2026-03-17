/**
 * /clear <batch-id> — Remove available cards from a batch (operator only).
 */

import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import { clearBatch } from '../db.js';

export function clearCommand(db: Database.Database) {
  return async (ctx: Context) => {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/);
    const batchId = parts[1];

    if (!batchId) {
      await ctx.reply('Usage: /clear <batch-id>\n\nRemoves all available (unsent) cards from the specified batch.');
      return;
    }

    const { deleted, skipped } = clearBatch(db, batchId);

    if (deleted === 0 && skipped === 0) {
      await ctx.reply(`No cards found for batch ${batchId}.`);
      return;
    }

    let msg = `Cleared ${deleted} available card(s) from batch ${batchId}.`;
    if (skipped > 0) {
      msg += `\n${skipped} delivered/reserved card(s) kept for audit trail.`;
    }
    await ctx.reply(msg);
  };
}
