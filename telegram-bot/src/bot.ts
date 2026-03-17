/**
 * Grammy bot setup with command registration and operator middleware.
 */

import { Bot, type CommandContext, type Context } from 'grammy';
import type Database from 'better-sqlite3';
import type { BotConfig } from './config.js';
import { loadCommand } from './commands/load.js';
import { stockCommand } from './commands/stock.js';
import { giftCommand } from './commands/gift.js';
import { buygiftCommand } from './commands/buygift.js';
import { setpriceCommand } from './commands/setprice.js';
import { clearCommand } from './commands/clear.js';
import { trustCommand, untrustCommand, trustedCommand } from './commands/trust.js';

type CmdHandler = (ctx: CommandContext<Context>) => Promise<void>;

/**
 * Middleware that restricts a command to the operator only.
 */
function operatorOnly(operatorId: number, handler: CmdHandler): CmdHandler {
  return async (ctx) => {
    if (ctx.from?.id !== operatorId) {
      await ctx.reply('This command is restricted to the bot operator.');
      return;
    }
    await handler(ctx);
  };
}

export function createBot(config: BotConfig, db: Database.Database): Bot {
  const bot = new Bot(config.telegramBotToken);

  // Operator-only commands
  bot.command('load', operatorOnly(config.operatorTelegramId, loadCommand(db, config)));
  bot.command('stock', operatorOnly(config.operatorTelegramId, stockCommand(db)));
  bot.command('setprice', operatorOnly(config.operatorTelegramId, setpriceCommand(db)));
  bot.command('clear', operatorOnly(config.operatorTelegramId, clearCommand(db)));
  bot.command('trust', operatorOnly(config.operatorTelegramId, trustCommand(db)));
  bot.command('untrust', operatorOnly(config.operatorTelegramId, untrustCommand(db)));
  bot.command('trusted', operatorOnly(config.operatorTelegramId, trustedCommand(db)));

  // Public commands (gift handles operator vs non-operator internally)
  bot.command('gift', giftCommand(db, config));
  bot.command('buygift', buygiftCommand(db, config));

  // Help command
  bot.command('start', async (ctx) => {
    const isOperator = ctx.from?.id === config.operatorTelegramId;
    let text = 'Hive Gift Card Bot\n\n';
    text += 'Available commands:\n';
    text += '/gift [@user] — Get a gift card (free from operator, HBD payment for others)\n';
    text += '/buygift [@user] — Purchase a gift card (HBD payment required)\n';

    if (isOperator) {
      text += '\nOperator commands:\n';
      text += '/load <batch-id> — Load cards from a batch\n';
      text += '/stock — Check inventory\n';
      text += '/setprice <amount> — Set HBD price\n';
      text += '/trust @user — Allow a user to gift for free\n';
      text += '/untrust @user — Revoke free gifting\n';
      text += '/trusted — List trusted users\n';
    }

    await ctx.reply(text);
  });

  bot.command('help', async (ctx) => {
    const isOperator = ctx.from?.id === config.operatorTelegramId;
    let text = 'Hive Gift Card Bot\n\n';
    text += '/gift [@user] — Get a gift card. Free for the operator, requires HBD payment for others.\n';
    text += '/buygift [@user] — Purchase a gift card. ' +
      'You will need to send HBD to the operator\'s Hive account with a specific memo.\n';

    if (isOperator) {
      text += '\nOperator commands:\n';
      text += '/load <batch-id> — Load cards from giftcard output directory\n';
      text += '/stock — View available/reserved/delivered counts\n';
      text += '/setprice <amount> — Set the HBD price per card (e.g. /setprice 5.000)\n';
    }

    await ctx.reply(text);
  });

  return bot;
}
