#!/usr/bin/env npx tsx
/**
 * Sets up an isolated giftcard workspace outside this repo.
 *
 * Includes both the giftcard redemption service AND the card generation
 * script, so the main repo never needs access to private keys.
 *
 * Usage:
 *   npx tsx scripts/setup-giftcard-isolated.ts [target-dir]
 *
 * Default target: ../giftcard-isolated
 *
 * The target mirrors the repo layout so import paths work unchanged:
 *   target/
 *     giftcard/src/...        Service source
 *     giftcard/package.json
 *     giftcard/tsconfig.json
 *     giftcard/Dockerfile     Docker build for Fly.io deployment
 *     scripts/                Card generation + PDF helper + deploy
 *       giftcard-generate.ts
 *       generate-invite-pdf.ts
 *       deploy-giftcard.ts
 *       package.json
 *     hive-branding/logo/...  Hive logo for invite PDFs
 *     certs/                  Self-signed TLS certs for LAN dev
 *     data/                   SQLite database (created at runtime)
 *     .env                    Secrets — edit before running
 *     start.ps1 / start.sh   Start the service
 *     generate.ps1 / generate.sh  Generate gift cards (forwards args)
 *     deploy.ps1 / deploy.sh      Deploy to Fly.io (forwards args)
 */

import { cpSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const defaultTarget = resolve(repoRoot, '..', 'giftcard-isolated');
const target = process.argv[2] ? resolve(process.argv[2]) : defaultTarget;

// If the target already exists, clean everything except .env and node_modules
// so we can re-deploy updated source without losing secrets or slow reinstalls.
if (existsSync(target)) {
  const preserve = new Set(['.env', 'node_modules']);
  for (const entry of readdirSync(target)) {
    if (preserve.has(entry)) continue;
    rmSync(join(target, entry), { recursive: true, force: true });
  }
  console.log(`Cleaned existing workspace (preserved .env + node_modules):\n  ${target}\n`);
} else {
  console.log(`Setting up isolated giftcard workspace at:\n  ${target}\n`);
}

// -- 1. Giftcard service source --
mkdirSync(target, { recursive: true });
cpSync(join(repoRoot, 'giftcard', 'src'), join(target, 'giftcard', 'src'), { recursive: true });
cpSync(join(repoRoot, 'giftcard', 'package.json'), join(target, 'giftcard', 'package.json'));
cpSync(join(repoRoot, 'giftcard', 'package-lock.json'), join(target, 'giftcard', 'package-lock.json'));
cpSync(join(repoRoot, 'giftcard', 'tsconfig.json'), join(target, 'giftcard', 'tsconfig.json'));
cpSync(join(repoRoot, 'giftcard', 'Dockerfile'), join(target, 'giftcard', 'Dockerfile'));
console.log('✓ Copied giftcard/ service source + Dockerfile');

// -- 2. Scripts (card generation + PDF helper) --
mkdirSync(join(target, 'scripts'), { recursive: true });
cpSync(
  join(repoRoot, 'scripts', 'giftcard-generate.ts'),
  join(target, 'scripts', 'giftcard-generate.ts'),
);
cpSync(
  join(repoRoot, 'scripts', 'generate-invite-pdf.ts'),
  join(target, 'scripts', 'generate-invite-pdf.ts'),
);
cpSync(
  join(repoRoot, 'scripts', 'deploy-giftcard.ts'),
  join(target, 'scripts', 'deploy-giftcard.ts'),
);
cpSync(
  join(repoRoot, 'scripts', 'package.json'),
  join(target, 'scripts', 'package.json'),
);
const scriptsLockSrc = join(repoRoot, 'scripts', 'package-lock.json');
if (existsSync(scriptsLockSrc)) {
  cpSync(scriptsLockSrc, join(target, 'scripts', 'package-lock.json'));
}
// feed-config.json contains proxy endpoints baked into card payloads
const feedConfigSrc = join(repoRoot, 'scripts', 'feed-config.json');
if (existsSync(feedConfigSrc)) {
  cpSync(feedConfigSrc, join(target, 'scripts', 'feed-config.json'));
}
console.log('✓ Copied scripts/ (giftcard-generate + generate-invite-pdf + deploy-giftcard + feed-config)');

// -- 3. Hive logo for invite PDFs --
const logoSrc = join(repoRoot, 'hive-branding', 'logo', 'png', 'logo_transparent@2.png');
const logoDest = join(target, 'hive-branding', 'logo', 'png', 'logo_transparent@2.png');
if (existsSync(logoSrc)) {
  mkdirSync(join(target, 'hive-branding', 'logo', 'png'), { recursive: true });
  cpSync(logoSrc, logoDest);
  console.log('✓ Copied Hive logo for invite PDFs');
} else {
  console.log('⚠ Hive logo not found — PDFs will use text fallback');
}

// -- 4. TLS certs --
const certsDir = join(target, 'certs');
mkdirSync(certsDir, { recursive: true });
const srcCerts = join(repoRoot, '.claude', 'certs');
if (existsSync(join(srcCerts, 'dev-cert.pem'))) {
  cpSync(join(srcCerts, 'dev-cert.pem'), join(certsDir, 'dev-cert.pem'));
  cpSync(join(srcCerts, 'dev-key.pem'), join(certsDir, 'dev-key.pem'));
  console.log('✓ Copied TLS dev certificates');
} else {
  console.log('⚠ No dev certs found at .claude/certs/ — generate them first');
}

// -- 5. Data directory --
mkdirSync(join(target, 'data'), { recursive: true });
console.log('✓ Created data/ directory');

// -- 6. .env (skip if already exists — preserves configured secrets) --
const envPath = join(target, '.env');
if (existsSync(envPath)) {
  console.log('✓ .env already exists — skipping (secrets preserved)');
} else {
  const envContent = `# Giftcard Isolated Workspace — Environment Variables
# Fill in the REPLACE_ME values before running anything.

# Hive account that owns claimed account tokens
GIFTCARD_PROVIDER_ACCOUNT=REPLACE_ME

# Provider's active key (WIF) — for create_claimed_account + delegate
GIFTCARD_ACTIVE_KEY=REPLACE_ME

# Provider's memo key (WIF) — for signing gift card authenticity
GIFTCARD_MEMO_KEY=REPLACE_ME

# HAA enrollment service account name
HAA_SERVICE_ACCOUNT=haa-service

# HP to delegate to new accounts (in VESTS)
GIFTCARD_DELEGATION_VESTS=30000.000000 VESTS

# SQLite database path (relative to giftcard/ since service runs from there)
GIFTCARD_DB_PATH=../data/tokens.db

# Server port
PORT=3200

# Cover site theme (tech, food, travel, etc.)
COVER_SITE_THEME=tech

# TLS certificates for HTTPS (relative to giftcard/ since service runs from there)
GIFTCARD_TLS_CERT=../certs/dev-cert.pem
GIFTCARD_TLS_KEY=../certs/dev-key.pem

# Gift card output directory (where generated cards are saved)
# Keep this outside the workspace so cards persist across re-deployments.
GIFTCARD_OUTPUT_DIR=D:\\HiveGiftCards

# Hive API nodes (comma-separated, optional — defaults to public nodes)
# HIVE_NODES=https://api.hive.blog,https://api.deathwing.me
`;
  writeFileSync(envPath, envContent);
  console.log('✓ Created .env (edit REPLACE_ME values before running)');
}

// -- 7. Start scripts (service) --
// Run from giftcard/ so tsx resolves from giftcard/node_modules.
// Env file and cert/data paths are relative to the workspace root,
// so we prefix them with ../ since cwd is giftcard/.
const startSh = `#!/bin/bash
# Start the giftcard redemption service (HTTPS on port 3200)
cd "$(dirname "$0")/giftcard"
node --env-file ../.env --import tsx src/server.ts
`;
writeFileSync(join(target, 'start.sh'), startSh, { mode: 0o755 });

const startPs1 = `# Start the giftcard redemption service (HTTPS on port 3200)
Set-Location (Join-Path $PSScriptRoot "giftcard")
node --env-file ../.env --import tsx src/server.ts
`;
writeFileSync(join(target, 'start.ps1'), startPs1);
console.log('✓ Created start.sh / start.ps1');

// -- 8. Generate scripts (card generation, forwards all args) --
// Scripts use `import 'dotenv/config'` which reads DOTENV_CONFIG_PATH.
// This is more reliable than --env-file across platforms.
const genSh = `#!/bin/bash
# Generate gift cards. All arguments are forwarded.
# Example:
#   ./generate.sh --count 5 --service-url https://haa-giftcard-prod.fly.dev --bootstrap-url https://demotruk.github.io/HiveAccessibleAnywhere/propolis-invite.html
#   ./generate.sh --count 1 --dry-run
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export DOTENV_CONFIG_PATH="\$SCRIPT_DIR/.env"
cd "\$SCRIPT_DIR/scripts"
node --import tsx giftcard-generate.ts "\$@"
`;
writeFileSync(join(target, 'generate.sh'), genSh, { mode: 0o755 });

const genPs1 = `# Generate gift cards. All arguments are forwarded.
# Example:
#   .\\generate.ps1 --count 5 --service-url https://haa-giftcard-prod.fly.dev --bootstrap-url https://demotruk.github.io/HiveAccessibleAnywhere/propolis-invite.html
#   .\\generate.ps1 --count 1 --dry-run
\$env:DOTENV_CONFIG_PATH = (Join-Path \$PSScriptRoot ".env")
Set-Location (Join-Path \$PSScriptRoot "scripts")
node --import tsx giftcard-generate.ts @args
`;
writeFileSync(join(target, 'generate.ps1'), genPs1);
console.log('✓ Created generate.sh / generate.ps1');

// -- 9. Deploy scripts (Fly.io deployment, forwards all args) --
const deploySh = `#!/bin/bash
# Deploy the giftcard service to Fly.io. All arguments are forwarded.
# Example:
#   ./deploy.sh --name prod --region lhr --theme tech
#   ./deploy.sh --dry-run --name test --region lhr
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export DOTENV_CONFIG_PATH="\$SCRIPT_DIR/.env"
cd "\$SCRIPT_DIR/scripts"
node --import tsx deploy-giftcard.ts "\$@"
`;
writeFileSync(join(target, 'deploy.sh'), deploySh, { mode: 0o755 });

const deployPs1 = `# Deploy the giftcard service to Fly.io. All arguments are forwarded.
# Example:
#   .\\deploy.ps1 --name prod --region lhr --theme tech
#   .\\deploy.ps1 --dry-run --name test --region lhr
\$env:DOTENV_CONFIG_PATH = (Join-Path \$PSScriptRoot ".env")
Set-Location (Join-Path \$PSScriptRoot "scripts")
node --import tsx deploy-giftcard.ts @args
`;
writeFileSync(join(target, 'deploy.ps1'), deployPs1);
console.log('✓ Created deploy.sh / deploy.ps1');

// -- 11. .gitignore --
writeFileSync(join(target, '.gitignore'), `node_modules/
data/
.env
certs/
scripts/giftcard-output/
`);
console.log('✓ Created .gitignore');

// -- 12. Install dependencies --
console.log('\nInstalling giftcard service dependencies...');
execSync('npm install', { cwd: join(target, 'giftcard'), stdio: 'inherit' });

console.log('\nInstalling scripts dependencies...');
execSync('npm install', { cwd: join(target, 'scripts'), stdio: 'inherit' });

console.log(`
${'='.repeat(56)}
  Isolated Giftcard Workspace Ready
${'='.repeat(56)}

  Directory: ${target}

  Files:
    .env              ← Edit REPLACE_ME values first!
    start.ps1         ← Start the redemption service (HTTPS)
    generate.ps1      ← Generate gift cards (forwards all args)
    deploy.ps1        ← Deploy service to Fly.io
    giftcard/         ← Service source code + Dockerfile
    scripts/          ← Generation + deploy scripts
    certs/            ← Self-signed TLS certs for LAN dev
    data/             ← SQLite DB (created at runtime)

  Gift card output:   GIFTCARD_OUTPUT_DIR (default: D:\\HiveGiftCards)
    Cards are saved outside the workspace so they persist across updates.

  Quick start:
    1. Edit .env — set GIFTCARD_PROVIDER_ACCOUNT, GIFTCARD_ACTIVE_KEY, GIFTCARD_MEMO_KEY

    2. Start the service:
         .\\start.ps1

    3. Verify (accept cert warning):
         https://localhost:3200/health

    4. Generate test cards:
         .\\generate.ps1 --count 1 --service-url https://192.168.1.116:3200 --bootstrap-url https://192.168.1.116:5176

    5. Dry-run (no DB, no on-chain):
         .\\generate.ps1 --count 1 --dry-run --bootstrap-url https://192.168.1.116:5176

    6. Deploy to Fly.io (dry-run first):
         .\\deploy.ps1 --dry-run --name prod --region lhr
         .\\deploy.ps1 --name prod --region lhr --theme tech

  Note: Phone will show a certificate warning for the self-signed cert.
        Tap "Advanced" → "Proceed" to continue.
`);
