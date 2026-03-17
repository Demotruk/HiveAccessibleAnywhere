/**
 * /gift [@username] — Send a gift card.
 *
 * Operator: free, no payment required.
 * Other users: redirects to /buygift payment flow.
 *
 * If @username is omitted, the card goes to the sender.
 */

import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import type { BotConfig } from '../config.js';
import { getAvailableCard, markCardDelivered, getCardCounts, isTrustedUser } from '../db.js';
import { sendCardImages } from '../send-card.js';
import { buygiftCommand } from './buygift.js';

export function giftCommand(db: Database.Database, config: BotConfig) {
  return async (ctx: Context) => {
    if (!ctx.from) return;

    const isOperator = ctx.from.id === config.operatorTelegramId;
    const isTrusted = isTrustedUser(db, String(ctx.from.id));

    // If not operator or trusted, delegate to buygift (payment required)
    if (!isOperator && !isTrusted) {
      return buygiftCommand(db, config)(ctx);
    }

    // --- Operator flow: free gift ---

    // Parse recipient (optional @mention)
    const entities = ctx.message?.entities || [];
    const text = ctx.message?.text || '';
    const mention = entities.find(e => e.type === 'mention' || e.type === 'text_mention');

    let recipientId: number;
    let recipientName: string;

    if (mention) {
      if (mention.type === 'text_mention' && mention.user) {
        recipientId = mention.user.id;
        recipientName = mention.user.first_name;
      } else {
        // @username mention — we don't have their numeric ID
        recipientName = text.slice(mention.offset, mention.offset + mention.length);
        await ctx.reply(
          `Cannot DM ${recipientName} — I need their user ID.\n\n` +
          `Ask them to send /start to me in a private message first, then try again.`,
        );
        return;
      }
    } else {
      // No mention — send to operator themselves
      recipientId = ctx.from.id;
      recipientName = ctx.from.first_name || 'you';
    }

    // Check stock
    const counts = getCardCounts(db);
    if (counts.available === 0) {
      await ctx.reply('No gift cards available. Please try again later.');
      return;
    }

    // Get an available card
    const card = getAvailableCard(db);
    if (!card) {
      await ctx.reply('No gift cards available. Please try again later.');
      return;
    }

    try {
      await sendCardImages(ctx.api, recipientId, card.pdf_path, {
        recipientName,
        inviteUrl: card.invite_url,
      });
      markCardDelivered(db, card.id, String(recipientId));
      const target = recipientId === ctx.from.id ? 'you' : recipientName;
      await ctx.reply(`Gift card sent to ${target} via DM!`);
    } catch {
      await ctx.reply(
        `Could not DM ${recipientName}. They need to start a private chat with me first:\n` +
        `1. Open a DM with @${ctx.me.username}\n` +
        `2. Send /start\n` +
        `3. Then try /gift again here.`,
      );
    }
  };
}
