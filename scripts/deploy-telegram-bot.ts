import 'dotenv/config';

/**
 * Deploy the Telegram Gift Card Bot to Fly.io.
 *
 * Key differences from other services:
 * - No HTTP service (long-polling bot, not a web server)
 * - Must always be running (min_machines_running = 1)
 * - Needs a persistent Fly.io volume for SQLite
 * - Needs access to giftcard output directory (baked into image or loaded at runtime)
 * - Secrets: Telegram token, Hive account
 *
 * Usage:
 *   npx tsx deploy-telegram-bot.ts --name prod --region lhr
 *   npx tsx deploy-telegram-bot.ts --dry-run --name test
 *
 * Flags:
 *   --name <name>       App name suffix (auto-generated if omitted)
 *   --region <code>     Fly.io region code (default: lhr)
 *   --volume-size <gb>  Volume size in GB (default: 1)
 *   --dry-run           Show what would happen without deploying
 *
 * Environment variables (from scripts/.env or environment):
 *   TELEGRAM_BOT_TOKEN       - Telegram Bot API token
 *   OPERATOR_TELEGRAM_ID     - Operator's numeric Telegram user ID
 *   HIVE_ACCOUNT             - Hive account for receiving HBD payments
 *   GIFT_PRICE_HBD           - Default gift card price (e.g. "5.000")
 *
 * Requires: fly CLI installed and authenticated
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// -- Parse args --

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const region = getArg('--region', 'lhr');
const volumeSize = parseInt(getArg('--volume-size', '1'), 10);
const nameIdx = args.indexOf('--name');
const appName = nameIdx >= 0 && args[nameIdx + 1]
  ? `haa-telegram-${args[nameIdx + 1]}`
  : `haa-telegram-${randomSuffix()}`;

function randomSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// -- Env validation --

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

// -- Paths --

const BOT_DIR = resolve(import.meta.dirname, '..', 'telegram-bot');

// -- Main --

async function main() {
  // Validate env vars needed for secrets
  const telegramBotToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const operatorTelegramId = requireEnv('OPERATOR_TELEGRAM_ID');
  const hiveAccount = requireEnv('HIVE_ACCOUNT');
  const giftPriceHbd = process.env.GIFT_PRICE_HBD || '5.000';
  const paymentTimeoutMinutes = process.env.PAYMENT_TIMEOUT_MINUTES || '30';

  console.log('=== Telegram Gift Card Bot Deployer ===');
  console.log(`App name:     ${appName}`);
  console.log(`Region:       ${region}`);
  console.log(`Volume:       ${volumeSize}GB`);
  console.log(`Operator ID:  ${operatorTelegramId}`);
  console.log(`Hive account: @${hiveAccount}`);
  console.log(`Price:        ${giftPriceHbd} HBD`);
  console.log(`Mode:         ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // The bot is a long-running process, not an HTTP service.
  // Use [processes] instead of [http_service] so Fly doesn't health-check an HTTP port.
  // min_machines_running = 1 ensures the bot is always polling Telegram.
  const flyToml = `app = '${appName}'
primary_region = '${region}'

[build]

[env]
  DB_PATH = '/data/bot.db'
  GIFT_PRICE_HBD = '${giftPriceHbd}'
  PAYMENT_TIMEOUT_MINUTES = '${paymentTimeoutMinutes}'
  GIFTCARD_OUTPUT_DIR = '/app/giftcard-output'

[processes]
  app = 'node --import tsx src/index.ts'

[mounts]
  source = 'telegram_bot_data'
  destination = '/data'

[[vm]]
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 256
  auto_stop_machines = 'off'
  min_machines_running = 1
`;

  if (dryRun) {
    console.log('Generated fly.toml:');
    console.log(flyToml);
    console.log(`Would deploy from: ${BOT_DIR}`);
    console.log(`Would set secrets: TELEGRAM_BOT_TOKEN, OPERATOR_TELEGRAM_ID, HIVE_ACCOUNT`);
    console.log(`Would create ${volumeSize}GB volume: telegram_bot_data in region ${region}`);
    console.log('\nDry run complete. Remove --dry-run to deploy for real.');
    return;
  }

  // Check fly CLI is available
  try {
    execSync('fly version', { stdio: 'pipe' });
  } catch {
    console.error('Error: fly CLI not found. Install it from https://fly.io/docs/hands-on/install-flyctl/');
    process.exit(1);
  }

  // Write fly.toml into the bot directory
  const tomlPath = join(BOT_DIR, 'fly.toml');
  let origTomlContent: string | null = null;
  try {
    origTomlContent = readFileSync(tomlPath, 'utf-8');
  } catch { /* no existing fly.toml */ }

  writeFileSync(tomlPath, flyToml, 'utf-8');

  try {
    // 1. Launch the app
    console.log('Creating Fly.io app...');
    execSync(`fly launch --no-deploy --copy-config --name ${appName} --region ${region} --yes`, {
      cwd: BOT_DIR,
      stdio: 'inherit',
    });

    // 2. Create persistent volume
    console.log('\nCreating persistent volume...');
    execSync(`fly volumes create telegram_bot_data --size ${volumeSize} --region ${region} --yes -a ${appName}`, {
      cwd: BOT_DIR,
      stdio: 'inherit',
    });

    // 3. Set secrets
    console.log('\nSetting secrets...');
    execSync(
      `fly secrets set ` +
      `TELEGRAM_BOT_TOKEN="${telegramBotToken}" ` +
      `OPERATOR_TELEGRAM_ID="${operatorTelegramId}" ` +
      `HIVE_ACCOUNT="${hiveAccount}" ` +
      `-a ${appName}`,
      {
        cwd: BOT_DIR,
        stdio: 'inherit',
      },
    );

    // 4. Deploy
    console.log('\nDeploying...');
    execSync('fly deploy', {
      cwd: BOT_DIR,
      stdio: 'inherit',
    });

    console.log(`\nDeployed! App: ${appName}`);
  } finally {
    // Restore original fly.toml (or remove it)
    if (origTomlContent) {
      writeFileSync(tomlPath, origTomlContent, 'utf-8');
    }
  }

  console.log('\nNext steps:');
  console.log(`  1. Check logs:     fly logs -a ${appName}`);
  console.log(`  2. Upload cards:   fly ssh sftp shell -a ${appName}`);
  console.log(`                     put local-batch-dir /data/giftcard-output/batch-id`);
  console.log(`  3. Load in bot:    /load batch-id (in Telegram)`);
  console.log('');
  console.log('Note: Gift card PDFs must be uploaded to /data/giftcard-output/ on the Fly volume.');
  console.log('Use `fly ssh sftp` or `fly ssh console` to manage files.');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
