import 'dotenv/config';

/**
 * Deploy a new HAA proxy instance to Fly.io.
 *
 * Usage:
 *   npx tsx deploy-proxy.ts --name my-proxy --region lhr --theme travel
 *   npx tsx deploy-proxy.ts --region sin --theme food
 *   npx tsx deploy-proxy.ts --name backup --region fra --theme tech --add-to-config
 *   npx tsx deploy-proxy.ts --dry-run --name test --region lhr
 *
 * Flags:
 *   --name <name>       App name on Fly.io (auto-generated if omitted)
 *   --region <code>     Fly.io region code (default: lhr)
 *   --theme <name>      Cover site theme: nature, food, travel, tech (default: nature)
 *   --add-to-config     Append the deployed URL to feed-config.json endpoints
 *   --dry-run           Show what would happen without deploying
 *
 * Requires: fly CLI installed and authenticated (https://fly.io/docs/hands-on/install-flyctl/)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// -- Parse args --

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const addToConfig = args.includes('--add-to-config');

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const region = getArg('--region', 'lhr');
const theme = getArg('--theme', 'nature');
const nameIdx = args.indexOf('--name');
const appName = nameIdx >= 0 && args[nameIdx + 1]
  ? `haa-proxy-${args[nameIdx + 1]}`
  : `haa-proxy-${randomSuffix()}`;

function randomSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// -- Paths --

const PROXY_DIR = resolve(import.meta.dirname, '..', 'proxy');
const CONFIG_PATH = resolve(import.meta.dirname, 'feed-config.json');

// -- Main --

async function main() {
  const deployedUrl = `https://${appName}.fly.dev`;

  console.log('=== HAA Proxy Deployer ===');
  console.log(`App name:  ${appName}`);
  console.log(`Region:    ${region}`);
  console.log(`Theme:     ${theme}`);
  console.log(`URL:       ${deployedUrl}`);
  console.log(`Mode:      ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Generate a temporary fly.toml for this instance
  const flyToml = `app = '${appName}'
primary_region = '${region}'

[build]

[env]
  COVER_SITE_THEME = '${theme}'
  PROXY_INSTANCE_ID = '${appName}'

[http_service]
  internal_port = 3100
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

[[vm]]
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 256
`;

  if (dryRun) {
    console.log('Generated fly.toml:');
    console.log(flyToml);
    console.log(`Would deploy from: ${PROXY_DIR}`);
    if (addToConfig) {
      console.log(`Would add ${deployedUrl} to ${CONFIG_PATH}`);
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

  // Write temp fly.toml into the proxy directory
  const origToml = join(PROXY_DIR, 'fly.toml');
  let origTomlContent: string | null = null;
  try {
    origTomlContent = readFileSync(origToml, 'utf-8');
  } catch { /* no existing fly.toml */ }

  writeFileSync(origToml, flyToml, 'utf-8');

  try {
    // Launch the app (creates the app on Fly.io)
    console.log('Creating Fly.io app...');
    execSync(`fly launch --no-deploy --copy-config --name ${appName} --region ${region} --yes`, {
      cwd: PROXY_DIR,
      stdio: 'inherit',
    });

    // Deploy
    console.log('\nDeploying...');
    execSync('fly deploy', {
      cwd: PROXY_DIR,
      stdio: 'inherit',
    });

    console.log(`\nDeployed! ${deployedUrl}`);
  } finally {
    // Restore original fly.toml
    if (origTomlContent) {
      writeFileSync(origToml, origTomlContent, 'utf-8');
    }
  }

  // Optionally add to feed config
  if (addToConfig) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(raw);
      if (!config.endpoints) config.endpoints = [];
      if (!config.endpoints.includes(deployedUrl)) {
        config.endpoints.push(deployedUrl);
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        console.log(`Added ${deployedUrl} to ${CONFIG_PATH}`);
      } else {
        console.log(`${deployedUrl} already in config.`);
      }
    } catch (e) {
      console.warn(`Could not update feed-config.json: ${(e as Error).message}`);
    }
  }

  console.log('\nNext steps:');
  console.log(`  1. Verify: curl ${deployedUrl}/health`);
  console.log(`  2. Add to feed config and re-publish: npx tsx publish-feed.ts --auto-discover`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
