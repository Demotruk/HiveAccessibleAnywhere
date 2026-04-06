#!/usr/bin/env npx tsx
/**
 * Sets up a local testing workspace for the giftcard service, dashboard,
 * invite app, and restore app.
 *
 * Similar to setup-haa-live.ts but tailored for local development:
 * - No deploy scripts (local testing only)
 * - Local-friendly .env defaults (localhost URLs, port 3200)
 * - Convenience scripts to start all services
 *
 * Usage:
 *   npx tsx scripts/setup-haa-local.ts [target-dir]
 *
 * Default target: ../haa-local
 *
 * The target mirrors the repo layout so import paths work unchanged:
 *   target/
 *     giftcard/src/...        Service source
 *     giftcard/package.json
 *     giftcard/tsconfig.json
 *     dashboard/src/...       Dashboard source
 *     dashboard/package.json
 *     dashboard/vite.config.ts
 *     dashboard/index.html
 *     invite/src/...          Invite app source
 *     invite/package.json
 *     invite/vite.config.ts
 *     invite/index.html
 *     restore/src/...         Restore app source
 *     restore/package.json
 *     restore/vite.config.ts
 *     restore/index.html
 *     scripts/                Card generation scripts
 *       giftcard-generate.ts
 *       generate-invite-pdf.ts
 *       package.json
 *     certs/                  Self-signed TLS certs
 *     data/                   SQLite database (created at runtime)
 *     .env                    Configuration — edit before running
 *     start.ps1 / start.sh           Start the giftcard service
 *     dashboard.ps1 / dashboard.sh   Start dashboard dev server
 *     invite.ps1 / invite.sh         Start invite app dev server
 *     restore.ps1 / restore.sh       Start restore app dev server
 *     start-all.ps1 / start-all.sh   Start all services
 *     generate.ps1 / generate.sh     Generate gift cards (forwards args)
 */

import { cpSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const defaultTarget = resolve(repoRoot, '..', 'haa-local');
const target = process.argv[2] ? resolve(process.argv[2]) : defaultTarget;

// If the target already exists, clean everything except .env and node_modules
if (existsSync(target)) {
  const preserve = new Set(['.env', 'node_modules']);
  for (const entry of readdirSync(target)) {
    if (preserve.has(entry)) continue;
    rmSync(join(target, entry), { recursive: true, force: true });
  }
  console.log(`Cleaned existing workspace (preserved .env + node_modules):\n  ${target}\n`);
} else {
  console.log(`Setting up HAA local testing workspace at:\n  ${target}\n`);
}

// -- 1. Giftcard service source --
mkdirSync(target, { recursive: true });
cpSync(join(repoRoot, 'giftcard', 'src'), join(target, 'giftcard', 'src'), { recursive: true });
cpSync(join(repoRoot, 'giftcard', 'package.json'), join(target, 'giftcard', 'package.json'));
cpSync(join(repoRoot, 'giftcard', 'package-lock.json'), join(target, 'giftcard', 'package-lock.json'));
cpSync(join(repoRoot, 'giftcard', 'tsconfig.json'), join(target, 'giftcard', 'tsconfig.json'));
cpSync(join(repoRoot, 'giftcard', 'assets'), join(target, 'giftcard', 'assets'), { recursive: true });
console.log('✓ Copied giftcard/ service source + assets');

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
// Copy mock server for local testing
const mockServerSrc = join(repoRoot, 'dashboard', 'mock-server.ts');
if (existsSync(mockServerSrc)) {
  cpSync(mockServerSrc, join(target, 'dashboard', 'mock-server.ts'));
  console.log('✓ Copied dashboard/ source + mock server');
} else {
  console.log('✓ Copied dashboard/ source');
}

// -- 3. Invite app source --
function copyApp(name: string) {
  const appDir = join(target, name);
  mkdirSync(appDir, { recursive: true });
  cpSync(join(repoRoot, name, 'src'), join(appDir, 'src'), { recursive: true });
  cpSync(join(repoRoot, name, 'package.json'), join(appDir, 'package.json'));
  cpSync(join(repoRoot, name, 'vite.config.ts'), join(appDir, 'vite.config.ts'));
  cpSync(join(repoRoot, name, 'index.html'), join(appDir, 'index.html'));
  const tsconfig = join(repoRoot, name, 'tsconfig.json');
  if (existsSync(tsconfig)) cpSync(tsconfig, join(appDir, 'tsconfig.json'));
  const lockFile = join(repoRoot, name, 'package-lock.json');
  if (existsSync(lockFile)) cpSync(lockFile, join(appDir, 'package-lock.json'));
}

copyApp('invite');
// Also copy test-robust.html if it exists (used for testing robust variant)
const testRobustSrc = join(repoRoot, 'invite', 'test-robust.html');
if (existsSync(testRobustSrc)) {
  cpSync(testRobustSrc, join(target, 'invite', 'test-robust.html'));
}
// Copy build-locales.js for multi-locale builds
const buildLocalesSrc = join(repoRoot, 'invite', 'build-locales.js');
if (existsSync(buildLocalesSrc)) {
  cpSync(buildLocalesSrc, join(target, 'invite', 'build-locales.js'));
}
console.log('✓ Copied invite/ app source');

// -- 4. Restore app source --
copyApp('restore');
const restoreBuildLocalesSrc = join(repoRoot, 'restore', 'build-locales.js');
if (existsSync(restoreBuildLocalesSrc)) {
  cpSync(restoreBuildLocalesSrc, join(target, 'restore', 'build-locales.js'));
}
console.log('✓ Copied restore/ app source');

// -- 4b. Root tsconfig (extended by dashboard, invite, restore) --
cpSync(join(repoRoot, 'tsconfig.json'), join(target, 'tsconfig.json'));
console.log('✓ Copied root tsconfig.json');

// -- 5. Scripts (card generation only — no deploy scripts needed locally) --
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
  join(repoRoot, 'scripts', 'package.json'),
  join(target, 'scripts', 'package.json'),
);
const scriptsLockSrc = join(repoRoot, 'scripts', 'package-lock.json');
if (existsSync(scriptsLockSrc)) {
  cpSync(scriptsLockSrc, join(target, 'scripts', 'package-lock.json'));
}
const feedConfigSrc = join(repoRoot, 'scripts', 'feed-config.json');
if (existsSync(feedConfigSrc)) {
  cpSync(feedConfigSrc, join(target, 'scripts', 'feed-config.json'));
}
console.log('✓ Copied scripts/ (giftcard-generate + generate-invite-pdf + feed-config)');

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

// -- 7. Data directory --
mkdirSync(join(target, 'data'), { recursive: true });
console.log('✓ Created data/ directory');

// -- 8. .env (skip if already exists — preserves configured secrets) --
const envPath = join(target, '.env');
if (existsSync(envPath)) {
  console.log('✓ .env already exists — skipping (secrets preserved)');
} else {
  const envContent = `# HAA Local Testing Workspace — Environment Variables
# Fill in the REPLACE_ME values before running anything.

# Hive account that owns claimed account tokens
GIFTCARD_PROVIDER_ACCOUNT=REPLACE_ME

# Provider's active key (WIF) — for create_claimed_account + delegate
GIFTCARD_ACTIVE_KEY=REPLACE_ME

# Provider's memo key (WIF) — for signing gift card authenticity
GIFTCARD_MEMO_KEY=REPLACE_ME

# Provider's posting key (WIF) — for auto-follow and community subscribe on new accounts
GIFTCARD_POSTING_KEY=REPLACE_ME

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

# Gift card output directory
GIFTCARD_OUTPUT_DIR=../giftcard-output

# Public URL of this service (for local testing, use localhost)
GIFTCARD_SERVICE_URL=https://localhost:3200

# Base URL for invite/restore apps (local invite dev server)
# Generated QR codes and PDFs will point here instead of hiveinvite.com
# Use your LAN IP for phone testing (e.g. https://192.168.1.100:5175)
GIFTCARD_INVITE_BASE_URL=https://localhost:5175

# --- Dashboard API ---

# JWT signing secret for dashboard authentication
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GIFTCARD_JWT_SECRET=REPLACE_ME

# Comma-separated list of Hive usernames allowed to use the dashboard.
# GIFTCARD_ALLOWED_PROVIDERS=issuer1,issuer2

# Hive API nodes (comma-separated, optional — defaults to public nodes)
# HIVE_NODES=https://api.hive.blog,https://api.deathwing.me
`;
  writeFileSync(envPath, envContent);
  console.log('✓ Created .env (edit REPLACE_ME values before running)');
}

// -- 9. Start script (giftcard service) --
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

// -- 10. Dashboard dev script --
const dashSh = `#!/bin/bash
# Start the dashboard Vite dev server (port 5179, proxies to giftcard service on :3200)
cd "$(dirname "$0")/dashboard"
npx vite --host localhost
`;
writeFileSync(join(target, 'dashboard.sh'), dashSh, { mode: 0o755 });

const dashPs1 = `# Start the dashboard Vite dev server (port 5179, proxies to giftcard service on :3200)
Set-Location (Join-Path $PSScriptRoot "dashboard")
npx vite --host localhost
`;
writeFileSync(join(target, 'dashboard.ps1'), dashPs1);
console.log('✓ Created dashboard.sh / dashboard.ps1');

// -- 11. Frontend static server (HTTPS, all locales, production-like paths) --
// Serves both invite and restore apps from a single HTTPS server on port 5175,
// mirroring the production layout where both live under the same domain:
//   /invite/index.html            → English invite
//   /invite/es/index.html         → Spanish invite
//   /restore/index.html           → English restore
//   /restore/es/index.html        → Spanish restore
const frontendServeSrc = `
const https = require('https');
const { readFileSync, existsSync, readdirSync } = require('fs');
const { resolve, join } = require('path');

const ROOT = __dirname;
const CERT_DIR = resolve(ROOT, 'certs');
const INVITE_DIST = resolve(ROOT, 'invite', 'dist', 'standard');
const RESTORE_DIST = resolve(ROOT, 'restore', 'dist');
const PORT = parseInt(process.env.PORT || '5175');

if (!existsSync(join(CERT_DIR, 'dev-cert.pem'))) {
  console.error('No TLS certs found at certs/ — cannot start HTTPS server');
  process.exit(1);
}

// Build the file map: URL path → file content
const files = {};

function addFile(urlPath, filePath) {
  if (existsSync(filePath)) {
    const content = readFileSync(filePath);
    files[urlPath] = content;
    // Also serve without trailing index.html
    if (urlPath.endsWith('/index.html')) {
      files[urlPath.replace('/index.html', '/')] = content;
    }
  }
}

// Invite: English
addFile('/invite/index.html', join(INVITE_DIST, 'index.html'));

// Invite: locale-specific (index-es.html → /invite/es/)
if (existsSync(INVITE_DIST)) {
  for (const f of readdirSync(INVITE_DIST)) {
    const m = f.match(/^index-([a-z]{2})\\.html$/);
    if (m) addFile('/invite/' + m[1] + '/index.html', join(INVITE_DIST, f));
  }
}

// Restore: English (restore-en.html or index.html)
const restoreEn = join(RESTORE_DIST, 'restore-en.html');
const restoreDefault = join(RESTORE_DIST, 'index.html');
addFile('/restore/index.html', existsSync(restoreEn) ? restoreEn : restoreDefault);

// Restore: locale-specific (restore-es.html → /restore/es/)
if (existsSync(RESTORE_DIST)) {
  for (const f of readdirSync(RESTORE_DIST)) {
    const m = f.match(/^restore-([a-z]{2})\\.html$/);
    if (m && m[1] !== 'en') addFile('/restore/' + m[1] + '/index.html', join(RESTORE_DIST, f));
  }
}

if (Object.keys(files).length === 0) {
  console.error('No built files found. Run build-locales.js in invite/ and restore/ first.');
  process.exit(1);
}

const server = https.createServer({
  cert: readFileSync(join(CERT_DIR, 'dev-cert.pem')),
  key: readFileSync(join(CERT_DIR, 'dev-key.pem')),
}, (req, res) => {
  let url = req.url.split('?')[0].split('#')[0];
  const content = files[url] || files[url + '/'] || files[url + '/index.html'];
  if (content) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Frontend apps (HTTPS, all locales) listening on port ' + PORT);
  console.log('Routes:');
  for (const path of Object.keys(files).filter(p => p.endsWith('/')).sort()) {
    console.log('  https://localhost:' + PORT + path);
  }
});
`;
// Place serve.cjs at workspace root (serves both invite and restore)
writeFileSync(join(target, 'serve-frontend.cjs'), frontendServeSrc);

const inviteSh = `#!/bin/bash
# Build all invite + restore locales and serve with HTTPS static server
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Building invite app (all locales)..."
cd "\$SCRIPT_DIR/invite"
node build-locales.js
echo ""
echo "Building restore app (all locales)..."
cd "\$SCRIPT_DIR/restore"
node build-locales.js
echo ""
cd "\$SCRIPT_DIR"
node serve-frontend.cjs
`;
writeFileSync(join(target, 'invite.sh'), inviteSh, { mode: 0o755 });

const invitePs1 = `# Build all invite + restore locales and serve with HTTPS static server
Write-Host "Building invite app (all locales)..." -ForegroundColor Cyan
Set-Location (Join-Path $PSScriptRoot "invite")
node build-locales.js
Write-Host ""
Write-Host "Building restore app (all locales)..." -ForegroundColor Cyan
Set-Location (Join-Path $PSScriptRoot "restore")
node build-locales.js
Write-Host ""
Set-Location $PSScriptRoot
node serve-frontend.cjs
`;
writeFileSync(join(target, 'invite.ps1'), invitePs1);
console.log('✓ Created invite.sh / invite.ps1');

// -- 12. Restore app dev script --
// Note: In production-like mode, restore is served by serve-frontend.cjs (via invite.ps1).
// This standalone script is for restore-only development.
const restoreSh = `#!/bin/bash
# Start the restore app Vite dev server (single locale, for dev only)
# For production-like multi-locale serving, use invite.sh instead.
cd "$(dirname "$0")/restore"
npx vite --host localhost
`;
writeFileSync(join(target, 'restore.sh'), restoreSh, { mode: 0o755 });

const restorePs1 = `# Start the restore app Vite dev server (single locale, for dev only)
# For production-like multi-locale serving, use invite.ps1 instead.
Set-Location (Join-Path $PSScriptRoot "restore")
npx vite --host localhost
`;
writeFileSync(join(target, 'restore.ps1'), restorePs1);
console.log('✓ Created restore.sh / restore.ps1');

// -- 13. Start-all script (all services) --
const startAllSh = `#!/bin/bash
# Start all services: giftcard, dashboard, invite, and restore.
# Background services are cleaned up on Ctrl+C.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS=()

cleanup() {
  echo "Stopping all services..."
  for pid in "\${PIDS[@]}"; do
    kill "\$pid" 2>/dev/null
  done
  exit
}
trap cleanup INT TERM

# Start giftcard service in background
echo "Starting giftcard service on port 3200..."
cd "\$SCRIPT_DIR/giftcard"
node --env-file ../.env --import tsx src/server.ts &
PIDS+=(\$!)

sleep 2

# Build and start invite + restore apps in background (HTTPS, all locales)
echo "Building invite app (all locales)..."
cd "\$SCRIPT_DIR/invite"
node build-locales.js
echo "Building restore app (all locales)..."
cd "\$SCRIPT_DIR/restore"
node build-locales.js
echo "Starting frontend static server..."
cd "\$SCRIPT_DIR"
node serve-frontend.cjs &
PIDS+=(\$!)

# Start dashboard in foreground
echo "Starting dashboard dev server on port 5179..."
cd "\$SCRIPT_DIR/dashboard"
npx vite --host localhost

cleanup
`;
writeFileSync(join(target, 'start-all.sh'), startAllSh, { mode: 0o755 });

const startAllPs1 = [
  '# Start all services in separate terminal windows.',
  '# Close any window to stop that service. Ctrl+C in the giftcard window',
  '# to see claim logs in real time.',
  '',
  '$root = $PSScriptRoot',
  '',
  '# Giftcard service',
  'Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location \'$(Join-Path $root giftcard)\'; Write-Host \'Giftcard service (HTTPS :3200)\' -ForegroundColor Cyan; node --env-file ../.env --import tsx src/server.ts"',
  '',
  'Start-Sleep -Seconds 1',
  '',
  '# Invite + Restore apps (build all locales + HTTPS static server)',
  'Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location \'$(Join-Path $root invite)\'; Write-Host \'Building invite app (all locales)...\' -ForegroundColor Cyan; node build-locales.js; Set-Location \'$(Join-Path $root restore)\'; Write-Host \'Building restore app (all locales)...\' -ForegroundColor Cyan; node build-locales.js; Set-Location \'$root\'; Write-Host \'\'; node serve-frontend.cjs"',
  '',
  '# Dashboard in this window',
  'Write-Host "Starting dashboard dev server on port 5179..." -ForegroundColor Cyan',
  'Set-Location (Join-Path $root "dashboard")',
  'npx vite --host localhost',
].join('\n');
writeFileSync(join(target, 'start-all.ps1'), startAllPs1);
console.log('✓ Created start-all.sh / start-all.ps1');

// -- 14. Generate scripts (card generation, forwards all args) --
const genSh = `#!/bin/bash
# Generate gift cards. All arguments are forwarded.
# Example:
#   ./generate.sh --count 5 --service-url https://localhost:3200
#   ./generate.sh --count 1 --dry-run
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export DOTENV_CONFIG_PATH="\$SCRIPT_DIR/.env"
cd "\$SCRIPT_DIR/scripts"
node --import tsx giftcard-generate.ts "\$@"
`;
writeFileSync(join(target, 'generate.sh'), genSh, { mode: 0o755 });

const genPs1 = `# Generate gift cards. All arguments are forwarded.
# Example:
#   .\\generate.ps1 --count 5 --service-url https://localhost:3200
#   .\\generate.ps1 --count 1 --dry-run
\$env:DOTENV_CONFIG_PATH = (Join-Path \$PSScriptRoot ".env")
Set-Location (Join-Path \$PSScriptRoot "scripts")
node --import tsx giftcard-generate.ts @args
`;
writeFileSync(join(target, 'generate.ps1'), genPs1);
console.log('✓ Created generate.sh / generate.ps1');

// -- 15. .gitignore --
writeFileSync(join(target, '.gitignore'), `node_modules/
data/
.env
certs/
giftcard-output/
scripts/giftcard-output/
dashboard/dist/
invite/dist/
restore/dist/
`);
console.log('✓ Created .gitignore');

// -- 16. Install dependencies --
console.log('\nInstalling giftcard service dependencies...');
execSync('npm install', { cwd: join(target, 'giftcard'), stdio: 'inherit' });

console.log('\nInstalling dashboard dependencies...');
execSync('npm install', { cwd: join(target, 'dashboard'), stdio: 'inherit' });

console.log('\nInstalling invite app dependencies...');
execSync('npm install', { cwd: join(target, 'invite'), stdio: 'inherit' });

console.log('\nInstalling restore app dependencies...');
execSync('npm install', { cwd: join(target, 'restore'), stdio: 'inherit' });

console.log('\nInstalling scripts dependencies...');
execSync('npm install', { cwd: join(target, 'scripts'), stdio: 'inherit' });

console.log(`
${'='.repeat(56)}
  HAA Local Testing Workspace Ready
${'='.repeat(56)}

  Directory: ${target}

  Files:
    .env              ← Edit REPLACE_ME values first!
    start.ps1         ← Start the giftcard service (HTTPS :3200)
    dashboard.ps1     ← Start dashboard dev server (:5179)
    invite.ps1        ← Build + serve invite & restore (HTTPS, all locales)
    restore.ps1       ← Restore app dev server (single locale)
    start-all.ps1     ← Start all services at once
    generate.ps1      ← Generate gift cards (forwards all args)
    giftcard/         ← Service source code
    dashboard/        ← Dashboard source code
    invite/           ← Invite app source code
    restore/          ← Restore app source code
    scripts/          ← Card generation scripts
    certs/            ← Self-signed TLS certs
    data/             ← SQLite DB (created at runtime)

  Quick start:
    1. Edit .env — set GIFTCARD_PROVIDER_ACCOUNT, GIFTCARD_ACTIVE_KEY,
       GIFTCARD_MEMO_KEY, GIFTCARD_JWT_SECRET

    2. Start everything:
         .\\start-all.ps1

       Or start individually:
         .\\start.ps1           # Giftcard service (:3200)
         .\\dashboard.ps1       # Dashboard (:5179)
         .\\invite.ps1          # Invite app
         .\\restore.ps1         # Restore app

    3. Verify service (accept cert warning):
         https://localhost:3200/health

    4. Open dashboard:
         http://localhost:5179/dashboard/

    5. Generate test cards:
         .\\generate.ps1 --count 1 --service-url https://localhost:3200

    6. Dry-run (no DB, no on-chain):
         .\\generate.ps1 --count 1 --dry-run

  Note: Browser will show a certificate warning for the self-signed cert.
        Click "Advanced" → "Proceed" to continue.
`);
