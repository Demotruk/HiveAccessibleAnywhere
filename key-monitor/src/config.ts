/**
 * Key monitor configuration.
 *
 * Loads and validates environment variables at startup.
 * Exits with a clear error message if required variables are missing.
 */

export interface MonitorConfig {
  /** Hive accounts to watch for unexpected operations */
  watchAccounts: string[];
  /** Telegram Bot API token for alerts */
  telegramBotToken: string;
  /** Telegram chat ID to send alerts to */
  telegramChatId: string;
  /** Hive API nodes */
  hiveNodes: string[];
  /** Polling interval in milliseconds */
  pollIntervalMs: number;
  /** Path to state persistence file */
  stateFile: string;
}

/** Operation types that are expected from the gift card service */
export const ALLOWED_OPERATIONS = new Set([
  'create_claimed_account',
  'delegate_vesting_shares',
]);

export function loadConfig(): MonitorConfig {
  const watchAccountsRaw = process.env.WATCH_ACCOUNTS;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  const missing: string[] = [];
  if (!watchAccountsRaw) missing.push('WATCH_ACCOUNTS');
  if (!telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!telegramChatId) missing.push('TELEGRAM_CHAT_ID');

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const name of missing) console.error(`  - ${name}`);
    process.exit(1);
  }

  const watchAccounts = watchAccountsRaw!.split(',').map(s => s.trim()).filter(Boolean);
  if (watchAccounts.length === 0) {
    console.error('WATCH_ACCOUNTS must contain at least one account name');
    process.exit(1);
  }

  const nodesRaw = process.env.HIVE_NODES;
  const hiveNodes = nodesRaw
    ? nodesRaw.split(',').map(s => s.trim())
    : ['https://api.hive.blog', 'https://api.deathwing.me', 'https://hive-api.arcange.eu'];

  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10);

  return {
    watchAccounts,
    telegramBotToken: telegramBotToken!,
    telegramChatId: telegramChatId!,
    hiveNodes,
    pollIntervalMs,
    stateFile: process.env.STATE_FILE || './data/state.json',
  };
}
