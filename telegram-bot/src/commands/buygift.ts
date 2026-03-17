/**
 * /buygift [@username] — Purchase a gift card (any user, requires payment).
 *
 * Offers two payment methods:
 *   (a) Send HBD directly to the operator's Hive account with a memo
 *   (b) Pay via Bitcoin Lightning using a v4v.app invoice
 *
 * In both cases the operator receives HBD on Hive with the payment memo,
 * so the existing transfer monitor confirms and delivers the card.
 */

import { randomBytes } from 'node:crypto';
import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import type { BotConfig } from '../config.js';
import {
  getAvailableCard,
  reserveCard,
  createPayment,
  getConfigValue,
  getCardCounts,
} from '../db.js';
import { createV4vInvoice } from '../v4v.js';

function generatePaymentId(): string {
  return randomBytes(4).toString('hex');
}

function formatHbd(amount: string): string {
  // Ensure 3 decimal places
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return '5.000';
  return num.toFixed(3);
}

export function buygiftCommand(db: Database.Database, config: BotConfig) {
  return async (ctx: Context) => {
    if (!ctx.from || !ctx.chat) return;

    // Check stock
    const counts = getCardCounts(db);
    if (counts.available === 0) {
      await ctx.reply('Sorry, no gift cards are currently available. Please try again later.');
      return;
    }

    // Parse recipient
    const entities = ctx.message?.entities || [];
    const text = ctx.message?.text || '';
    const mention = entities.find(e => e.type === 'mention' || e.type === 'text_mention');

    let recipientUserId: string | null = null;
    let recipientUsername: string | null = null;

    if (mention) {
      if (mention.type === 'text_mention' && mention.user) {
        recipientUserId = String(mention.user.id);
        recipientUsername = mention.user.username || mention.user.first_name;
      } else {
        recipientUsername = text.slice(mention.offset + 1, mention.offset + mention.length); // strip @
      }
    }

    // Get price (from DB config or env default)
    const priceOverride = getConfigValue(db, 'gift_price_hbd');
    const price = formatHbd(priceOverride || config.giftPriceHbd);

    // Reserve a card
    const card = getAvailableCard(db);
    if (!card) {
      await ctx.reply('Sorry, no gift cards are currently available. Please try again later.');
      return;
    }

    const paymentId = generatePaymentId();
    reserveCard(db, card.id, paymentId);

    // Create payment record
    const expiresAt = new Date(Date.now() + config.paymentTimeoutMinutes * 60_000).toISOString();
    createPayment(db, {
      id: paymentId,
      telegramUserId: String(ctx.from.id),
      telegramChatId: String(ctx.chat.id),
      recipientUserId,
      recipientUsername,
      amountHbd: price,
      expiresAt,
      cardId: card.id,
    });

    const recipientLabel = recipientUsername ? `@${recipientUsername}` : 'yourself';
    const memo = `pay-${paymentId}`;

    // Generate v4v.app Lightning invoice
    let lightningSection = '';
    try {
      const invoice = await createV4vInvoice({
        hiveAccount: config.hiveAccount,
        amountHbd: price,
        memo,
        expirySeconds: config.paymentTimeoutMinutes * 60,
      });

      const satsLabel = invoice.amountSats > 0
        ? ` (~${invoice.amountSats.toLocaleString()} sats)`
        : '';

      lightningSection =
        `\n\nOption B — Pay with Bitcoin Lightning${satsLabel}:\n` +
        `${invoice.paymentRequest}\n\n` +
        `Copy the invoice above into any Lightning wallet to pay.`;
    } catch (err) {
      console.error('v4v.app invoice generation failed:', err);
      lightningSection =
        '\n\n(Bitcoin Lightning payment is temporarily unavailable.)';
    }

    await ctx.reply(
      `To purchase a gift card for ${recipientLabel}:\n\n` +
      `Option A — Pay with HBD:\n` +
      `Send ${price} HBD to @${config.hiveAccount} on Hive\n` +
      `Memo: ${memo}` +
      lightningSection +
      `\n\nThe gift card will be sent automatically once payment is confirmed.\n` +
      `This offer expires in ${config.paymentTimeoutMinutes} minutes.`,
    );
  };
}
