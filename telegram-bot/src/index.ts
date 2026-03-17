/**
 * Telegram Gift Card Bot — entry point.
 *
 * Distributes Propolis gift cards in Telegram group chats.
 * Operator can send cards free; other users pay in HBD.
 */

import 'dotenv/config';
import { config as hiveTxConfig } from 'hive-tx';
import { loadConfig } from './config.js';
import { initDatabase } from './db.js';
import { createBot } from './bot.js';
import { startTransferMonitor } from './hive/transfer-monitor.js';

const config = loadConfig();

// Configure hive-tx nodes
hiveTxConfig.nodes = config.hiveNodes;

// Initialize database
const db = initDatabase(config.dbPath);
console.log(`Database initialized at ${config.dbPath}`);

// Create and start bot
const bot = createBot(config, db);

// Start HBD transfer monitor
startTransferMonitor(bot, db, config);

// Start polling
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started (polling mode)`);
    console.log(`Operator Telegram ID: ${config.operatorTelegramId}`);
    console.log(`Hive account: ${config.hiveAccount}`);
    console.log(`Gift card price: ${config.giftPriceHbd} HBD`);
    console.log(`Payment timeout: ${config.paymentTimeoutMinutes} minutes`);
    console.log(`Card output dir: ${config.giftcardOutputDir}`);
  },
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down...');
  bot.stop();
  db.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
