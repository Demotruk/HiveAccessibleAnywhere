/**
 * /stock — Check gift card inventory (operator only).
 */

import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import { getCardCounts } from '../db.js';

export function stockCommand(db: Database.Database) {
  return async (ctx: Context) => {
    const counts = getCardCounts(db);
    const total = counts.available + counts.reserved + counts.delivered;
    await ctx.reply(
      `Gift card inventory:\n` +
      `  Available: ${counts.available}\n` +
      `  Reserved (awaiting payment): ${counts.reserved}\n` +
      `  Delivered: ${counts.delivered}\n` +
      `  Total: ${total}`,
    );
  };
}
