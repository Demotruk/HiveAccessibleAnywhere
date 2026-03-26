/**
 * Bot configuration.
 *
 * Loads and validates environment variables at startup.
 * Exits with a clear error message if required variables are missing.
 * Discord fields are optional — if DISCORD_BOT_TOKEN is absent, Discord bot is skipped.
 */

export interface BotConfig {
  /** Telegram Bot API token */
  telegramBotToken: string;
  /** Operator's Telegram user ID (numeric) */
  operatorTelegramId: number;
  /** Hive account that receives HBD payments */
  hiveAccount: string;
  /** Hive API nodes */
  hiveNodes: string[];
  /** Path to giftcard output directory */
  giftcardOutputDir: string;
  /** Default gift card price in HBD (e.g. "5.000") */
  giftPriceHbd: string;
  /** Minutes to wait for payment before expiry */
  paymentTimeoutMinutes: number;
  /** SQLite database path */
  dbPath: string;
  /** Discord Bot Token (optional — Discord bot only starts if set) */
  discordBotToken?: string;
  /** Discord Application ID (required if discordBotToken is set) */
  discordApplicationId?: string;
  /** Operator's Discord user ID (required if discordBotToken is set) */
  operatorDiscordId?: string;
}

export function loadConfig(): BotConfig {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const operatorTelegramId = process.env.OPERATOR_TELEGRAM_ID;
  const hiveAccount = process.env.HIVE_ACCOUNT;

  const missing: string[] = [];
  if (!telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!operatorTelegramId) missing.push('OPERATOR_TELEGRAM_ID');
  if (!hiveAccount) missing.push('HIVE_ACCOUNT');

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const name of missing) console.error(`  - ${name}`);
    process.exit(1);
  }

  const parsedOperatorId = parseInt(operatorTelegramId!, 10);
  if (isNaN(parsedOperatorId)) {
    console.error('OPERATOR_TELEGRAM_ID must be a numeric Telegram user ID');
    process.exit(1);
  }

  const nodesRaw = process.env.HIVE_NODES;
  const hiveNodes = nodesRaw
    ? nodesRaw.split(',').map(s => s.trim())
    : ['https://api.hive.blog', 'https://api.deathwing.me', 'https://hive-api.arcange.eu'];

  // Discord config (optional — bot only starts if token is provided)
  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  const discordApplicationId = process.env.DISCORD_APPLICATION_ID;
  const operatorDiscordId = process.env.OPERATOR_DISCORD_ID;

  if (discordBotToken) {
    const discordMissing: string[] = [];
    if (!discordApplicationId) discordMissing.push('DISCORD_APPLICATION_ID');
    if (!operatorDiscordId) discordMissing.push('OPERATOR_DISCORD_ID');
    if (discordMissing.length > 0) {
      console.error('DISCORD_BOT_TOKEN is set but these required Discord variables are missing:');
      for (const name of discordMissing) console.error(`  - ${name}`);
      process.exit(1);
    }
  }

  return {
    telegramBotToken: telegramBotToken!,
    operatorTelegramId: parsedOperatorId,
    hiveAccount: hiveAccount!,
    hiveNodes,
    giftcardOutputDir: process.env.GIFTCARD_OUTPUT_DIR || '../scripts/giftcard-output',
    giftPriceHbd: process.env.GIFT_PRICE_HBD || '5.000',
    paymentTimeoutMinutes: parseInt(process.env.PAYMENT_TIMEOUT_MINUTES || '30', 10),
    dbPath: process.env.DB_PATH || './data/bot.db',
    discordBotToken: discordBotToken || undefined,
    discordApplicationId: discordApplicationId || undefined,
    operatorDiscordId: operatorDiscordId || undefined,
  };
}
