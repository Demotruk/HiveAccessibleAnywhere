import 'dotenv/config';

/**
 * Deploy the HAA Gift Card Service to Fly.io.
 *
 * Handles both first-time deployment and redeployment of existing apps.
 * On first deploy: creates app, volume, sets secrets, deploys code.
 * On redeploy: updates secrets and deploys code (skips app/volume creation).
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
 * Environment variables (from .env):
 *   GIFTCARD_PROVIDER_ACCOUNT    - Hive account with claimed account tokens
 *   GIFTCARD_ACTIVE_KEY          - Provider's active key (WIF)
 *   GIFTCARD_MEMO_KEY            - Provider's memo key (WIF)
 *   HAA_SERVICE_ACCOUNT          - Feed service account
 *   GIFTCARD_DELEGATION_VESTS    - Delegation amount (e.g. '30000.000000 VESTS')
 *   GIFTCARD_JWT_SECRET          - JWT signing secret (for dashboard API)
 *   GIFTCARD_ALLOWED_PROVIDERS   - Comma-separated issuer whitelist (for dashboard)
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

// -- Helpers --

/** Check if a Fly.io app already exists. */
function appExists(name: string): boolean {
  try {
    execSync(`fly status -a ${name}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Check if the app already has a volume. */
function hasVolume(name: string): boolean {
  try {
    const output = execSync(`fly volumes list -a ${name} --json`, { stdio: 'pipe' }).toString();
    const volumes = JSON.parse(output);
    return Array.isArray(volumes) && volumes.length > 0;
  } catch {
    return false;
  }
}

// -- Main --

async function main() {
  const deployedUrl = `https://${appName}.fly.dev`;

  // Validate env vars needed for secrets
  const providerAccount = requireEnv('GIFTCARD_PROVIDER_ACCOUNT');
  const haaServiceAccount = requireEnv('HAA_SERVICE_ACCOUNT');
  const delegationVests = requireEnv('GIFTCARD_DELEGATION_VESTS');

  // Multi-tenant: service account holds delegated authority, provider keys optional
  const serviceAccount = process.env.GIFTCARD_SERVICE_ACCOUNT || '';
  const serviceActiveKey = process.env.GIFTCARD_SERVICE_ACTIVE_KEY || '';
  const serviceMemoKey = process.env.GIFTCARD_SERVICE_MEMO_KEY || '';
  const multiTenant = !!(serviceAccount && serviceActiveKey);

  // Provider keys: required in single-tenant, optional in multi-tenant
  const activeKey = process.env.GIFTCARD_ACTIVE_KEY || '';
  const memoKey = process.env.GIFTCARD_MEMO_KEY || '';
  if (!multiTenant) {
    if (!activeKey) { console.error('Missing GIFTCARD_ACTIVE_KEY (required in single-tenant mode)'); process.exit(1); }
    if (!memoKey) { console.error('Missing GIFTCARD_MEMO_KEY (required in single-tenant mode)'); process.exit(1); }
  }

  // Dashboard API (optional but needed for dashboard to work)
  const jwtSecret = process.env.GIFTCARD_JWT_SECRET || '';
  const allowedProviders = process.env.GIFTCARD_ALLOWED_PROVIDERS || '';
  const serviceUrl = process.env.GIFTCARD_SERVICE_URL || '';

  // Additional optional env vars
  const postingKey = process.env.GIFTCARD_POSTING_KEY || '';
  const preapprovedIssuers = process.env.GIFTCARD_PREAPPROVED_ISSUERS || '';
  const adminAccounts = process.env.GIFTCARD_ADMIN_ACCOUNTS || '';
  const notifyAccount = process.env.GIFTCARD_NOTIFY_ACCOUNT || '';
  const notifyActiveKey = process.env.GIFTCARD_NOTIFY_ACTIVE_KEY || '';
  const notifyCurrency = process.env.GIFTCARD_NOTIFY_CURRENCY || '';
  const dashboardUrl = process.env.GIFTCARD_DASHBOARD_URL || '';
  const inviteBaseUrl = process.env.GIFTCARD_INVITE_BASE_URL || '';

  console.log('=== HAA Gift Card Service Deployer ===');
  console.log(`App name:     ${appName}`);
  console.log(`Region:       ${region}`);
  console.log(`Theme:        ${theme}`);
  console.log(`Volume:       ${volumeSize}GB`);
  console.log(`Provider:     @${providerAccount}`);
  console.log(`HAA Service:  @${haaServiceAccount}`);
  console.log(`Delegation:   ${delegationVests}`);
  console.log(`Multi-tenant: ${multiTenant ? `yes (service: @${serviceAccount})` : 'no'}`);
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

  // Build secrets as key=value pairs for `fly secrets import` (reads from stdin, never in CLI args)
  const secretEntries: [string, string][] = [
    ['GIFTCARD_PROVIDER_ACCOUNT', providerAccount],
    ['HAA_SERVICE_ACCOUNT', haaServiceAccount],
    ['GIFTCARD_DELEGATION_VESTS', delegationVests],
  ];
  if (activeKey) secretEntries.push(['GIFTCARD_ACTIVE_KEY', activeKey]);
  if (memoKey) secretEntries.push(['GIFTCARD_MEMO_KEY', memoKey]);

  // Multi-tenant
  if (serviceAccount) secretEntries.push(['GIFTCARD_SERVICE_ACCOUNT', serviceAccount]);
  if (serviceActiveKey) secretEntries.push(['GIFTCARD_SERVICE_ACTIVE_KEY', serviceActiveKey]);
  if (serviceMemoKey) secretEntries.push(['GIFTCARD_SERVICE_MEMO_KEY', serviceMemoKey]);
  if (allowedProviders) secretEntries.push(['GIFTCARD_ALLOWED_PROVIDERS', allowedProviders]);
  if (preapprovedIssuers) secretEntries.push(['GIFTCARD_PREAPPROVED_ISSUERS', preapprovedIssuers]);
  if (adminAccounts) secretEntries.push(['GIFTCARD_ADMIN_ACCOUNTS', adminAccounts]);

  // Dashboard API
  if (jwtSecret) secretEntries.push(['GIFTCARD_JWT_SECRET', jwtSecret]);
  if (serviceUrl) secretEntries.push(['GIFTCARD_SERVICE_URL', serviceUrl]);
  if (dashboardUrl) secretEntries.push(['GIFTCARD_DASHBOARD_URL', dashboardUrl]);
  if (inviteBaseUrl) secretEntries.push(['GIFTCARD_INVITE_BASE_URL', inviteBaseUrl]);

  // Posting key (auto-follow, community subscribe)
  if (postingKey) secretEntries.push(['GIFTCARD_POSTING_KEY', postingKey]);

  // Notifications
  if (notifyAccount) secretEntries.push(['GIFTCARD_NOTIFY_ACCOUNT', notifyAccount]);
  if (notifyActiveKey) secretEntries.push(['GIFTCARD_NOTIFY_ACTIVE_KEY', notifyActiveKey]);
  if (notifyCurrency) secretEntries.push(['GIFTCARD_NOTIFY_CURRENCY', notifyCurrency]);

  // Format for display (names only, never values)
  const secretNames = secretEntries.map(([k]) => k);
  // Format for fly secrets import (key=value lines piped via stdin)
  const secretsStdin = secretEntries.map(([k, v]) => `${k}=${v}`).join('\n');

  if (dryRun) {
    // Check if app exists to show accurate dry-run info
    let existing = false;
    try {
      execSync('fly version', { stdio: 'pipe' });
      existing = appExists(appName);
    } catch {
      // fly CLI not available, can't check
    }

    console.log('Generated fly.toml:');
    console.log(flyToml);
    console.log(`Would deploy from: ${GIFTCARD_DIR}`);
    console.log(`Would set secrets: ${secretNames.join(', ')}`);
    if (existing) {
      console.log(`\nApp "${appName}" already exists — would redeploy (update secrets + code).`);
      console.log('Existing volume and data will be preserved.');
    } else {
      console.log(`\nApp "${appName}" does not exist — would create app + ${volumeSize}GB volume in region ${region}.`);
    }
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

  // Detect if this is a first deploy or a redeploy
  const existing = appExists(appName);
  if (existing) {
    console.log(`App "${appName}" already exists — redeploying.\n`);
  } else {
    console.log(`App "${appName}" not found — creating new deployment.\n`);
  }

  // Write fly.toml into the giftcard directory
  const tomlPath = join(GIFTCARD_DIR, 'fly.toml');
  let origTomlContent: string | null = null;
  try {
    origTomlContent = readFileSync(tomlPath, 'utf-8');
  } catch { /* no existing fly.toml */ }

  writeFileSync(tomlPath, flyToml, 'utf-8');

  try {
    // 1. Create app (first deploy only)
    if (!existing) {
      console.log('Creating Fly.io app...');
      execSync(`fly launch --no-deploy --copy-config --name ${appName} --region ${region} --yes`, {
        cwd: GIFTCARD_DIR,
        stdio: 'inherit',
      });
    }

    // 2. Create persistent volume (first deploy or if missing)
    if (!existing || !hasVolume(appName)) {
      console.log('\nCreating persistent volume...');
      execSync(`fly volumes create giftcard_data --size ${volumeSize} --region ${region} --yes -a ${appName}`, {
        cwd: GIFTCARD_DIR,
        stdio: 'inherit',
      });
    } else {
      console.log('Volume already exists — skipping creation.');
    }

    // 3. Set secrets via stdin (never pass secrets as CLI arguments)
    console.log(`\nSetting ${secretEntries.length} secrets...`);
    try {
      execSync(
        `fly secrets import -a ${appName}`,
        {
          cwd: GIFTCARD_DIR,
          input: secretsStdin,
          stdio: ['pipe', 'inherit', 'pipe'],
        },
      );
    } catch (err: unknown) {
      // Redact: only show the fly command and exit code, never the secret values
      const code = (err as { status?: number }).status ?? 1;
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() || '';
      console.error(`Failed to set secrets (exit code ${code})`);
      if (stderr) console.error(stderr);
      process.exit(1);
    }

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
