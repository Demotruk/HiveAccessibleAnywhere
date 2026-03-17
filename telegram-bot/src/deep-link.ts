/**
 * Deep link handler for gift card claims.
 *
 * When a user taps a t.me/Bot?start=gc_CODE link, this module
 * looks up the shared link, delivers the card, and marks it claimed.
 */

import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import { getSharedLink, claimSharedLink, markCardDelivered } from './db.js';
import { sendCardImages } from './send-card.js';

export async function handleDeepLink(
  ctx: Context,
  db: Database.Database,
  code: string,
): Promise<void> {
  if (!ctx.from) return;

  const link = getSharedLink(db, code);

  if (!link) {
    await ctx.reply('This gift card link is not valid.');
    return;
  }

  if (link.claimed_by) {
    await ctx.reply('This gift card has already been claimed.');
    return;
  }

  if (link.status === 'delivered') {
    await ctx.reply('This gift card has already been delivered.');
    return;
  }

  const userId = ctx.from.id;

  try {
    await sendCardImages(ctx.api, userId, link.pdf_path, {
      recipientName: ctx.from.first_name,
      inviteUrl: link.invite_url,
    });

    claimSharedLink(db, code, String(userId));
    markCardDelivered(db, link.card_id, String(userId));

    await ctx.reply(
      'Your gift card has been delivered above! Scan the QR code or tap the invite link to create your Hive account.',
    );
  } catch (err) {
    console.error(`Failed to deliver card for shared link ${code}:`, err);
    await ctx.reply('Something went wrong delivering your gift card. Please try again or contact the operator.');
  }
}
