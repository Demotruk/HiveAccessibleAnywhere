/**
 * /setprice <amount> — Set the HBD price for gift cards (operator only).
 */

import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import { setConfigValue } from '../db.js';

export function setpriceCommand(db: Database.Database) {
  return async (ctx: Context) => {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/);
    const amountStr = parts[1];

    if (!amountStr) {
      await ctx.reply('Usage: /setprice <amount>\n\nExample: /setprice 5.000');
      return;
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Invalid amount. Please enter a positive number (e.g. 5.000).');
      return;
    }

    const formatted = amount.toFixed(3);
    setConfigValue(db, 'gift_price_hbd', formatted);
    await ctx.reply(`Gift card price set to ${formatted} HBD.`);
  };
}
