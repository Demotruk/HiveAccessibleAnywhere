/**
 * Gift Card Bot — entry point.
 *
 * Distributes Propolis gift cards via Telegram and (optionally) Discord.
 * Operator can send cards free; other users pay in HBD.
 */

import 'dotenv/config';
import { config as hiveTxConfig } from 'hive-tx';
import { loadConfig } from './config.js';
import { initDatabase } from './db.js';
import { createBot } from './bot.js';
import { createDiscordBot, startDiscordBot } from './discord-bot.js';
import { startTransferMonitor } from './hive/transfer-monitor.js';
import { startApplicationMonitor } from './hive/application-monitor.js';
import { TelegramNotifier, DiscordNotifier, type PaymentNotifier } from './notifier.js';

const config = loadConfig();

// Configure hive-tx nodes
hiveTxConfig.nodes = config.hiveNodes;

// Initialize database
const db = initDatabase(config.dbPath);
console.log(`Database initialized at ${config.dbPath}`);

// Create Telegram bot
const bot = createBot(config, db);

// Build notifier map for the transfer monitor
const notifiers = new Map<string, PaymentNotifier>();
notifiers.set('telegram', new TelegramNotifier(bot));

// Conditionally create Discord bot
let discordClient: import('discord.js').Client | null = null;

if (config.discordBotToken) {
  discordClient = createDiscordBot(config, db);
  notifiers.set('discord', new DiscordNotifier(discordClient));
} else {
  console.log('Discord bot: skipped (DISCORD_BOT_TOKEN not set)');
}

// Start HBD transfer monitor (shared across both platforms)
startTransferMonitor(notifiers, db, config);

// Start issuer application monitor (notifies operator via Telegram)
startApplicationMonitor(bot, db, config);

// Handle transient errors (network hiccups, API timeouts) without crashing
bot.catch((err) => {
  const msg = err.error instanceof Error ? err.error.message : String(err.error);
  console.error(`Grammy error in update ${err.ctx?.update?.update_id}:`, msg);
});

// Start Telegram polling (catch errors so they don't crash Discord)
bot.start({
  onStart: (botInfo) => {
    console.log(`Telegram bot @${botInfo.username} started (polling mode)`);
    console.log(`Operator Telegram ID: ${config.operatorTelegramId}`);
    console.log(`Hive account: ${config.hiveAccount}`);
    console.log(`Gift card price: ${config.giftPriceHbd} HBD`);
    console.log(`Payment timeout: ${config.paymentTimeoutMinutes} minutes`);
    console.log(`Card output dir: ${config.giftcardOutputDir}`);
  },
}).catch(err => {
  console.error('Telegram bot polling failed:', err.message);
  if (!discordClient || process.env.NODE_ENV === 'production') process.exit(1);
  console.log('Telegram polling stopped but Discord bot still running (dev mode).');
});

// Start Discord bot (if configured)
if (discordClient) {
  startDiscordBot(discordClient, config)
    .catch(err => {
      console.error('Failed to start Discord bot:', err);
      process.exit(1);
    });
}

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down...');
  bot.stop();
  discordClient?.destroy();
  db.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
