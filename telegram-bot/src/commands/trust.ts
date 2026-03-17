/**
 * /trust @user — Add a trusted user who can gift for free (operator only).
 * /untrust @user — Remove a trusted user (operator only).
 * /trusted — List all trusted users (operator only).
 */

import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import { addTrustedUser, removeTrustedUser, getTrustedUsers } from '../db.js';

export function trustCommand(db: Database.Database) {
  return async (ctx: Context) => {
    if (!ctx.from) return;

    const entities = ctx.message?.entities || [];
    const text = ctx.message?.text || '';
    const mention = entities.find(e => e.type === 'mention' || e.type === 'text_mention');

    if (!mention) {
      await ctx.reply('Usage: /trust @username\n\nGive a user permission to send free gift cards.');
      return;
    }

    let userId: string | undefined;
    let displayName: string;

    if (mention.type === 'text_mention' && mention.user) {
      userId = String(mention.user.id);
      displayName = mention.user.username ? `@${mention.user.username}` : mention.user.first_name;
    } else {
      displayName = text.slice(mention.offset, mention.offset + mention.length);
      await ctx.reply(
        `Cannot resolve ${displayName}'s user ID from a @username mention.\n\n` +
        `Ask them to send /start to the bot first, then try mentioning them again ` +
        `(Telegram needs to have seen them interact with the bot to resolve their ID).`,
      );
      return;
    }

    const added = addTrustedUser(db, userId, String(ctx.from.id));
    if (added) {
      await ctx.reply(`${displayName} is now a trusted user and can send free gift cards.`);
    } else {
      await ctx.reply(`${displayName} is already a trusted user.`);
    }
  };
}

export function untrustCommand(db: Database.Database) {
  return async (ctx: Context) => {
    if (!ctx.from) return;

    const entities = ctx.message?.entities || [];
    const text = ctx.message?.text || '';
    const mention = entities.find(e => e.type === 'mention' || e.type === 'text_mention');

    if (!mention) {
      await ctx.reply('Usage: /untrust @username');
      return;
    }

    let userId: string | undefined;
    let displayName: string;

    if (mention.type === 'text_mention' && mention.user) {
      userId = String(mention.user.id);
      displayName = mention.user.username ? `@${mention.user.username}` : mention.user.first_name;
    } else {
      displayName = text.slice(mention.offset, mention.offset + mention.length);
      await ctx.reply(`Cannot resolve ${displayName}'s user ID. They need to have interacted with the bot.`);
      return;
    }

    const removed = removeTrustedUser(db, userId);
    if (removed) {
      await ctx.reply(`${displayName} is no longer a trusted user.`);
    } else {
      await ctx.reply(`${displayName} was not a trusted user.`);
    }
  };
}

export function trustedCommand(db: Database.Database) {
  return async (ctx: Context) => {
    const users = getTrustedUsers(db);
    if (users.length === 0) {
      await ctx.reply('No trusted users. Use /trust @username to add one.');
      return;
    }

    const lines = users.map(u => {
      const note = u.note ? ` — ${u.note}` : '';
      return `• ID ${u.telegram_user_id} (added ${u.added_at})${note}`;
    });
    await ctx.reply(`Trusted users:\n${lines.join('\n')}`);
  };
}
