/**
 * /share [count] — Generate shareable deep links for gift cards.
 *
 * Operator-only. Reserves cards and returns t.me/Bot?start=gc_CODE links
 * that anyone can click to claim a card.
 */

import { randomBytes } from 'node:crypto';
import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import {
  getAvailableCard,
  reserveCard,
  createSharedLink,
  getCardCounts,
} from '../db.js';

function generateShortCode(): string {
  // 6 bytes = 8 chars base64url, plenty of entropy for gift cards
  return randomBytes(6).toString('base64url');
}

export function shareCommand(db: Database.Database) {
  return async (ctx: Context) => {
    if (!ctx.from) return;

    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/);
    const countArg = parts[1] ? parseInt(parts[1], 10) : 1;

    if (isNaN(countArg) || countArg < 1 || countArg > 20) {
      await ctx.reply('Usage: /share [count]\nCount must be 1–20.');
      return;
    }

    const counts = getCardCounts(db);
    if (counts.available < countArg) {
      await ctx.reply(
        `Not enough cards. Requested: ${countArg}, available: ${counts.available}.`,
      );
      return;
    }

    const botUsername = ctx.me.username;
    const links: string[] = [];

    for (let i = 0; i < countArg; i++) {
      const card = getAvailableCard(db);
      if (!card) break;

      const code = generateShortCode();
      reserveCard(db, card.id, `share-${code}`);
      createSharedLink(db, code, card.id, String(ctx.from.id));

      links.push(`https://t.me/${botUsername}?start=gc_${code}`);
    }

    if (links.length === 0) {
      await ctx.reply('No cards available.');
      return;
    }

    let reply = `Generated ${links.length} shareable link${links.length > 1 ? 's' : ''}:\n\n`;
    reply += links.join('\n');
    reply += '\n\nEach link can be claimed once. The recipient will receive the gift card when they tap the link.';

    await ctx.reply(reply);
  };
}
