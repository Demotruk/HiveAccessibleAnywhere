#!/usr/bin/env npx tsx
/**
 * Sets up the HAA live deployment workspace outside this repo.
 *
 * Includes the giftcard service, dashboard, and card generation scripts,
 * so the main repo never needs access to private keys.
 *
 * Usage:
 *   npx tsx scripts/setup-haa-live.ts [target-dir]
 *
 * Default target: ../haa-live
 *
 * The target mirrors the repo layout so import paths work unchanged:
 *   target/
 *     giftcard/src/...        Service source
 *     giftcard/package.json
 *     giftcard/tsconfig.json
 *     giftcard/Dockerfile     Docker build for Fly.io deployment
 *     dashboard/src/...       Dashboard source
 *     dashboard/package.json
 *     dashboard/vite.config.ts
 *     dashboard/index.html
 *     scripts/                Card generation + PDF helper + deploy
 *       giftcard-generate.ts
 *       generate-invite-pdf.ts
 *       deploy-giftcard.ts
 *       deploy-hiveinvite.ts
 *       package.json
 *     hive-branding/logo/...  Hive logo for invite PDFs
 *     certs/                  Self-signed TLS certs for LAN dev
 *     data/                   SQLite database (created at runtime)
 *     .env                    Secrets — edit before running
 *     start.ps1 / start.sh           Start the giftcard service
 *     dashboard-dev.ps1 / .sh         Start dashboard dev server
 *     generate.ps1 / generate.sh      Generate gift cards (forwards args)
 *     deploy.ps1 / deploy.sh          Deploy giftcard to Fly.io
 *     deploy-dashboard.ps1 / .sh      Build + deploy dashboard to HiveInvite.com
 */

import { cpSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const defaultTarget = resolve(repoRoot, '..', 'haa-live');
const target = process.argv[2] ? resolve(process.argv[2]) : defaultTarget;

// If the target already exists, clean everything except .env and node_modules dirs
if (existsSync(target)) {
  const preserve = new Set(['.env', 'node_modules']);
  for (const entry of readdirSync(target)) {
    if (preserve.has(entry)) continue;
    rmSync(join(target, entry), { recursive: true, force: true });
  }
  // Also preserve node_modules inside giftcard/, dashboard/, scripts/
  console.log(`Cleaned existing workspace (preserved .env + node_modules):\n  ${target}\n`);
} else {
  console.log(`Setting up HAA live deployment workspace at:\n  ${target}\n`);
}

// -- 1. Giftcard service source --
mkdirSync(target, { recursive: true });
cpSync(join(repoRoot, 'giftcard', 'src'), join(target, 'giftcard', 'src'), { recursive: true });
cpSync(join(repoRoot, 'giftcard', 'package.json'), join(target, 'giftcard', 'package.json'));
cpSync(join(repoRoot, 'giftcard', 'package-lock.json'), join(target, 'giftcard', 'package-lock.json'));
cpSync(join(repoRoot, 'giftcard', 'tsconfig.json'), join(target, 'giftcard', 'tsconfig.json'));
cpSync(join(repoRoot, 'giftcard', 'Dockerfile'), join(target, 'giftcard', 'Dockerfile'));
cpSync(join(repoRoot, 'giftcard', 'assets'), join(target, 'giftcard', 'assets'), { recursive: true });
console.log('✓ Copied giftcard/ service source + assets + Dockerfile');

// -- 2. Dashboard source --
mkdirSync(join(target, 'dashboard'), { recursive: true });
cpSync(join(repoRoot, 'dashboard', 'src'), join(target, 'dashboard', 'src'), { recursive: true });
cpSync(join(repoRoot, 'dashboard', 'package.json'), join(target, 'dashboard', 'package.json'));
cpSync(join(repoRoot, 'dashboard', 'vite.config.ts'), join(target, 'dashboard', 'vite.config.ts'));
cpSync(join(repoRoot, 'dashboard', 'index.html'), join(target, 'dashboard', 'index.html'));
cpSync(join(repoRoot, 'dashboard', 'tsconfig.json'), join(target, 'dashboard', 'tsconfig.json'));
const dashLockSrc = join(repoRoot, 'dashboard', 'package-lock.json');
if (existsSync(dashLockSrc)) {
  cpSync(dashLockSrc, join(target, 'dashboard', 'package-lock.json'));
}
console.log('✓ Copied dashboard/ source');

// -- 3. Scripts (card generation + PDF helper + deploy) --
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
  join(repoRoot, 'scripts', 'deploy-hiveinvite.ts'),
  join(target, 'scripts', 'deploy-hiveinvite.ts'),
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
console.log('✓ Copied scripts/ (giftcard-generate + generate-invite-pdf + deploy-giftcard + deploy-hiveinvite + feed-config)');

// -- 4. Hive logo for invite PDFs --
const logoSrc = join(repoRoot, 'hive-branding', 'logo', 'png', 'logo_transparent@2.png');
const logoDest = join(target, 'hive-branding', 'logo', 'png', 'logo_transparent@2.png');
if (existsSync(logoSrc)) {
  mkdirSync(join(target, 'hive-branding', 'logo', 'png'), { recursive: true });
  cpSync(logoSrc, logoDest);
  console.log('✓ Copied Hive logo for invite PDFs');
} else {
  console.log('⚠ Hive logo not found — PDFs will use text fallback');
}

// -- 5. Root tsconfig.json (dashboard extends it) --
cpSync(join(repoRoot, 'tsconfig.json'), join(target, 'tsconfig.json'));
console.log('✓ Copied root tsconfig.json');

// -- 5b. HiveInvite.com landing page --
const landingSrc = join(repoRoot, 'hiveinvite-site', 'index.html');
if (existsSync(landingSrc)) {
  mkdirSync(join(target, 'hiveinvite-site'), { recursive: true });
  cpSync(landingSrc, join(target, 'hiveinvite-site', 'index.html'));
  console.log('✓ Copied hiveinvite-site/index.html (landing page)');
} else {
  console.log('⚠ hiveinvite-site/index.html not found — deploy-dashboard will fail without it');
}

// -- 5c. Built invite app (for HiveInvite.com assembly) --
const inviteDistSrc = join(repoRoot, 'invite', 'dist');
if (existsSync(inviteDistSrc)) {
  cpSync(inviteDistSrc, join(target, 'invite', 'dist'), { recursive: true });
  console.log('✓ Copied invite/dist/ (built invite app)');
} else {
  console.log('⚠ invite/dist/ not found — run "npm run build:invite" first');
}

// -- 5d. Built restore app (for HiveInvite.com assembly) --
const restoreDistSrc = join(repoRoot, 'restore', 'dist');
if (existsSync(restoreDistSrc)) {
  cpSync(restoreDistSrc, join(target, 'restore', 'dist'), { recursive: true });
  console.log('✓ Copied restore/dist/ (built restore app)');
} else {
  console.log('⚠ restore/dist/ not found — run "npm run build:restore" first');
}

// -- 6. TLS certs --
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

// -- 6. Data directory --
mkdirSync(join(target, 'data'), { recursive: true });
console.log('✓ Created data/ directory');

// -- 7. .env (skip if already exists — preserves configured secrets) --
const envPath = join(target, '.env');
if (existsSync(envPath)) {
  console.log('✓ .env already exists — skipping (secrets preserved)');
} else {
  const envContent = `# HAA Live Deployment Workspace — Environment Variables
# Fill in the REPLACE_ME values before running anything.

# ============================================================
# Core — Required
# ============================================================

# Hive account that owns claimed account tokens
GIFTCARD_PROVIDER_ACCOUNT=REPLACE_ME

# Provider's active key (WIF) — for create_claimed_account + delegate
# Required in single-tenant mode; optional in multi-tenant (service account signs instead)
GIFTCARD_ACTIVE_KEY=REPLACE_ME

# Provider's memo key (WIF) — for signing gift card authenticity
# Required in single-tenant mode; optional in multi-tenant
GIFTCARD_MEMO_KEY=REPLACE_ME

# HAA enrollment service account name
HAA_SERVICE_ACCOUNT=haa-service

# HP to delegate to new accounts (in VESTS)
GIFTCARD_DELEGATION_VESTS=30000.000000 VESTS

# ============================================================
# Local Service Settings
# ============================================================

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

# ============================================================
# URLs
# ============================================================

# Public URL of this service (used in generated gift card QR payloads)
# Must match the Fly.io app URL or wherever the service is deployed.
GIFTCARD_SERVICE_URL=https://haa-giftcard-prod.fly.dev

# API base URL for the dashboard production build.
# This is baked into the built JS at build time.
API_BASE=https://haa-giftcard-prod.fly.dev

# Base URL for the issuer dashboard (used in approval notification memos)
GIFTCARD_DASHBOARD_URL=https://hiveinvite.com/dashboard

# Base URL for invite/restore apps (defaults to https://hiveinvite.com)
GIFTCARD_INVITE_BASE_URL=https://hiveinvite.com

# ============================================================
# Dashboard API
# ============================================================

# JWT signing secret for dashboard authentication (required for dashboard)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GIFTCARD_JWT_SECRET=REPLACE_ME

# ============================================================
# Multi-Tenant (optional — leave commented for single-tenant)
# ============================================================

# Shared service account (enables multi-tenant mode when both are set)
# GIFTCARD_SERVICE_ACCOUNT=
# GIFTCARD_SERVICE_ACTIVE_KEY=
# GIFTCARD_SERVICE_MEMO_KEY=

# Comma-separated list of Hive usernames allowed to use the dashboard.
# These are the approved issuers. The provider account is always allowed.
# GIFTCARD_ALLOWED_PROVIDERS=issuer1,issuer2

# Comma-separated list of issuers auto-approved on first login (skip application).
# GIFTCARD_PREAPPROVED_ISSUERS=

# Additional admin accounts (service account is always admin in multi-tenant)
# GIFTCARD_ADMIN_ACCOUNTS=

# ============================================================
# Account Operations
# ============================================================

# Posting key (WIF) for the service/provider account.
# Required for auto-follow and community subscribe on new accounts.
# GIFTCARD_POSTING_KEY=

# ============================================================
# Notifications (optional)
# ============================================================

# Account for sending approval/revocation notification memos
# GIFTCARD_NOTIFY_ACCOUNT=
# GIFTCARD_NOTIFY_ACTIVE_KEY=
# GIFTCARD_NOTIFY_CURRENCY=HBD

# ============================================================
# Other
# ============================================================

# Hive API nodes (comma-separated, optional — defaults to public nodes)
# HIVE_NODES=https://api.hive.blog,https://api.deathwing.me
`;
  writeFileSync(envPath, envContent);
  console.log('✓ Created .env (edit REPLACE_ME values before running)');
}

// -- 8. Start script (giftcard service) --
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

// -- 9. Dashboard dev script --
const dashDevSh = `#!/bin/bash
# Start the dashboard Vite dev server (port 5179, proxies to giftcard service on :3200)
cd "$(dirname "$0")/dashboard"
npx vite --host localhost
`;
writeFileSync(join(target, 'dashboard-dev.sh'), dashDevSh, { mode: 0o755 });

const dashDevPs1 = `# Start the dashboard Vite dev server (port 5179, proxies to giftcard service on :3200)
Set-Location (Join-Path $PSScriptRoot "dashboard")
npx vite --host localhost
`;
writeFileSync(join(target, 'dashboard-dev.ps1'), dashDevPs1);
console.log('✓ Created dashboard-dev.sh / dashboard-dev.ps1');

// -- 10. Generate scripts (card generation, forwards all args) --
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

// -- 11. Deploy giftcard scripts (Fly.io deployment, forwards all args) --
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

// -- 12. Deploy dashboard scripts (build + assemble HiveInvite.com site) --
const deployDashSh = `#!/bin/bash
# Build the dashboard and assemble the HiveInvite.com static site.
# All arguments are forwarded to deploy-hiveinvite.ts.
# Example:
#   ./deploy-dashboard.sh
#   ./deploy-dashboard.sh --output /path/to/hiveinvite-site/dist
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env for API_BASE
set -a
source "\$SCRIPT_DIR/.env"
set +a

# Build dashboard with production API_BASE
echo "Building dashboard..."
cd "\$SCRIPT_DIR/dashboard"
API_BASE="\$API_BASE" npx vite build
echo ""

# Assemble HiveInvite.com site
cd "\$SCRIPT_DIR/scripts"
node --import tsx deploy-hiveinvite.ts "\$@"
`;
writeFileSync(join(target, 'deploy-dashboard.sh'), deployDashSh, { mode: 0o755 });

const deployDashPs1 = `# Build the dashboard and assemble the HiveInvite.com static site.
# All arguments are forwarded to deploy-hiveinvite.ts.
# Example:
#   .\\deploy-dashboard.ps1
#   .\\deploy-dashboard.ps1 --output C:\\path\\to\\hiveinvite-site\\dist

# Load API_BASE from .env
\$envFile = Join-Path \$PSScriptRoot ".env"
Get-Content \$envFile | ForEach-Object {
    if (\$_ -match '^API_BASE=(.+)$') {
        \$env:API_BASE = \$Matches[1]
    }
}

# Build dashboard with production API_BASE
Write-Host "Building dashboard..."
Set-Location (Join-Path \$PSScriptRoot "dashboard")
npx vite build
Write-Host ""

# Assemble HiveInvite.com site
Set-Location (Join-Path \$PSScriptRoot "scripts")
node --import tsx deploy-hiveinvite.ts @args
`;
writeFileSync(join(target, 'deploy-dashboard.ps1'), deployDashPs1);
console.log('✓ Created deploy-dashboard.sh / deploy-dashboard.ps1');

// -- 13. .gitignore --
writeFileSync(join(target, '.gitignore'), `node_modules/
data/
.env
certs/
scripts/giftcard-output/
dashboard/dist/
`);
console.log('✓ Created .gitignore');

// -- 14. Install dependencies --
console.log('\nInstalling giftcard service dependencies...');
execSync('npm install', { cwd: join(target, 'giftcard'), stdio: 'inherit' });

console.log('\nInstalling dashboard dependencies...');
execSync('npm install', { cwd: join(target, 'dashboard'), stdio: 'inherit' });

console.log('\nInstalling scripts dependencies...');
execSync('npm install', { cwd: join(target, 'scripts'), stdio: 'inherit' });

console.log(`
${'='.repeat(56)}
  HAA Live Deployment Workspace Ready
${'='.repeat(56)}

  Directory: ${target}

  Files:
    .env                  ← Edit REPLACE_ME values first!
    start.ps1             ← Start the giftcard service (HTTPS)
    dashboard-dev.ps1     ← Start dashboard dev server (port 5179)
    generate.ps1          ← Generate gift cards (forwards all args)
    deploy.ps1            ← Deploy giftcard service to Fly.io
    deploy-dashboard.ps1  ← Build dashboard + assemble HiveInvite.com
    giftcard/             ← Service source code + Dockerfile
    dashboard/            ← Dashboard source code
    scripts/              ← Generation + deploy scripts
    certs/                ← Self-signed TLS certs for LAN dev
    data/                 ← SQLite DB (created at runtime)

  Gift card output:   GIFTCARD_OUTPUT_DIR (default: D:\\HiveGiftCards)
    Cards are saved outside the workspace so they persist across updates.

  Quick start:
    1. Edit .env — set GIFTCARD_PROVIDER_ACCOUNT, GIFTCARD_ACTIVE_KEY, GIFTCARD_MEMO_KEY

    2. Start the giftcard service:
         .\\start.ps1

    3. Start the dashboard (separate terminal):
         .\\dashboard-dev.ps1

    4. Verify service (accept cert warning):
         https://localhost:3200/health

    5. Open dashboard:
         http://localhost:5179/dashboard/

    6. Generate test cards:
         .\\generate.ps1 --count 1 --service-url https://192.168.1.116:3200 --bootstrap-url https://192.168.1.116:5176

    7. Deploy giftcard to Fly.io (dry-run first):
         .\\deploy.ps1 --dry-run --name prod --region lhr
         .\\deploy.ps1 --name prod --region lhr --theme tech

    8. Deploy dashboard to HiveInvite.com:
         .\\deploy-dashboard.ps1

  Note: Phone will show a certificate warning for the self-signed cert.
        Tap "Advanced" → "Proceed" to continue.
`);
