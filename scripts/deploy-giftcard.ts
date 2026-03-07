import 'dotenv/config';

/**
 * Deploy the HAA Gift Card Service to Fly.io.
 *
 * Key differences from the proxy deploy:
 * - Needs a persistent Fly.io volume for SQLite storage
 * - Secrets set via `fly secrets set` (private keys, not in fly.toml)
 * - Port 3200
 * - App name prefix: haa-giftcard-
 *
 * Usage:
 *   npx tsx deploy-giftcard.ts --name prod --region lhr --theme tech
 *   npx tsx deploy-giftcard.ts --dry-run --name test --region lhr
 *
 * Flags:
 *   --name <name>       App name suffix (auto-generated if omitted)
 *   --region <code>     Fly.io region code (default: lhr)
 *   --theme <name>      Cover site theme: nature, food, travel, tech (default: tech)
 *   --volume-size <gb>  Volume size in GB (default: 1)
 *   --dry-run           Show what would happen without deploying
 *
 * Environment variables (from scripts/.env):
 *   GIFTCARD_PROVIDER_ACCOUNT  - Hive account with claimed account tokens
 *   GIFTCARD_ACTIVE_KEY        - Provider's active key (WIF)
 *   GIFTCARD_MEMO_KEY          - Provider's memo key (WIF)
 *   HAA_SERVICE_ACCOUNT        - Feed service account
 *   GIFTCARD_DELEGATION_VESTS  - Delegation amount (e.g. '30000.000000 VESTS')
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
const theme = getArg('--theme', 'tech');
const volumeSize = parseInt(getArg('--volume-size', '1'), 10);
const nameIdx = args.indexOf('--name');
const appName = nameIdx >= 0 && args[nameIdx + 1]
  ? `haa-giftcard-${args[nameIdx + 1]}`
  : `haa-giftcard-${randomSuffix()}`;

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

const GIFTCARD_DIR = resolve(import.meta.dirname, '..', 'giftcard');

// -- Main --

async function main() {
  const deployedUrl = `https://${appName}.fly.dev`;

  // Validate env vars needed for secrets
  const providerAccount = requireEnv('GIFTCARD_PROVIDER_ACCOUNT');
  const activeKey = requireEnv('GIFTCARD_ACTIVE_KEY');
  const memoKey = requireEnv('GIFTCARD_MEMO_KEY');
  const haaServiceAccount = requireEnv('HAA_SERVICE_ACCOUNT');
  const delegationVests = requireEnv('GIFTCARD_DELEGATION_VESTS');

  console.log('=== HAA Gift Card Service Deployer ===');
  console.log(`App name:     ${appName}`);
  console.log(`Region:       ${region}`);
  console.log(`Theme:        ${theme}`);
  console.log(`Volume:       ${volumeSize}GB`);
  console.log(`Provider:     @${providerAccount}`);
  console.log(`HAA Service:  @${haaServiceAccount}`);
  console.log(`Delegation:   ${delegationVests}`);
  console.log(`URL:          ${deployedUrl}`);
  console.log(`Mode:         ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Generate fly.toml
  const flyToml = `app = '${appName}'
primary_region = '${region}'

[build]

[env]
  COVER_SITE_THEME = '${theme}'
  GIFTCARD_DB_PATH = '/data/tokens.db'

[http_service]
  internal_port = 3200
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

[mounts]
  source = 'giftcard_data'
  destination = '/data'

[[vm]]
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 256
`;

  if (dryRun) {
    console.log('Generated fly.toml:');
    console.log(flyToml);
    console.log(`Would deploy from: ${GIFTCARD_DIR}`);
    console.log(`Would set secrets: GIFTCARD_PROVIDER_ACCOUNT, GIFTCARD_ACTIVE_KEY, GIFTCARD_MEMO_KEY, HAA_SERVICE_ACCOUNT, GIFTCARD_DELEGATION_VESTS`);
    console.log(`Would create ${volumeSize}GB volume: giftcard_data in region ${region}`);
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

  // Write fly.toml into the giftcard directory
  const tomlPath = join(GIFTCARD_DIR, 'fly.toml');
  let origTomlContent: string | null = null;
  try {
    origTomlContent = readFileSync(tomlPath, 'utf-8');
  } catch { /* no existing fly.toml */ }

  writeFileSync(tomlPath, flyToml, 'utf-8');

  try {
    // 1. Launch the app (creates the app on Fly.io)
    console.log('Creating Fly.io app...');
    execSync(`fly launch --no-deploy --copy-config --name ${appName} --region ${region} --yes`, {
      cwd: GIFTCARD_DIR,
      stdio: 'inherit',
    });

    // 2. Create persistent volume for SQLite
    console.log('\nCreating persistent volume...');
    execSync(`fly volumes create giftcard_data --size ${volumeSize} --region ${region} --yes -a ${appName}`, {
      cwd: GIFTCARD_DIR,
      stdio: 'inherit',
    });

    // 3. Set secrets (private keys — never in fly.toml or env vars)
    console.log('\nSetting secrets...');
    execSync(
      `fly secrets set ` +
      `GIFTCARD_PROVIDER_ACCOUNT="${providerAccount}" ` +
      `GIFTCARD_ACTIVE_KEY="${activeKey}" ` +
      `GIFTCARD_MEMO_KEY="${memoKey}" ` +
      `HAA_SERVICE_ACCOUNT="${haaServiceAccount}" ` +
      `GIFTCARD_DELEGATION_VESTS="${delegationVests}" ` +
      `-a ${appName}`,
      {
        cwd: GIFTCARD_DIR,
        stdio: 'inherit',
      },
    );

    // 4. Deploy
    console.log('\nDeploying...');
    execSync('fly deploy', {
      cwd: GIFTCARD_DIR,
      stdio: 'inherit',
    });

    console.log(`\nDeployed! ${deployedUrl}`);
  } finally {
    // Restore original fly.toml (or remove it)
    if (origTomlContent) {
      writeFileSync(tomlPath, origTomlContent, 'utf-8');
    }
  }

  console.log('\nNext steps:');
  console.log(`  1. Verify health:  curl ${deployedUrl}/health`);
  console.log(`  2. Generate cards: npx tsx giftcard-generate.ts --count 10 --service-url ${deployedUrl}`);
  console.log(`  3. Test validate:  curl -X POST ${deployedUrl}/validate -H 'Content-Type: application/json' -d '{"token":"test"}'`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
