/**
 * Copy bootstrap HTML files from wallet/dist/ into docs/ for GitHub Pages.
 *
 * Usage:
 *   npx tsx deploy-pages.ts
 */

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WALLET_DIST = resolve(ROOT, 'wallet', 'dist');
const INVITE_DIST = resolve(ROOT, 'invite', 'dist');
const RESTORE_DIST = resolve(ROOT, 'restore', 'dist');
const DOCS = resolve(ROOT, 'docs');

const LOCALES = ['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi'];

mkdirSync(DOCS, { recursive: true });

for (const locale of LOCALES) {
  const src = resolve(WALLET_DIST, `propolis-bootstrap-${locale}.html`);
  const dest = resolve(DOCS, `propolis-bootstrap-${locale}.html`);
  copyFileSync(src, dest);
  console.log(`Copied: propolis-bootstrap-${locale}.html → docs/`);
}

// Copy invite app (single-file HTML)
const inviteSrc = resolve(INVITE_DIST, 'index.html');
if (existsSync(inviteSrc)) {
  copyFileSync(inviteSrc, resolve(DOCS, 'propolis-invite.html'));
  console.log('Copied: propolis-invite.html → docs/');
  // Also deploy to docs/invite/ so /invite/#hash URLs work on GitHub Pages
  const inviteDir = resolve(DOCS, 'invite');
  mkdirSync(inviteDir, { recursive: true });
  copyFileSync(inviteSrc, resolve(inviteDir, 'index.html'));
  console.log('Copied: invite/index.html → docs/invite/');
} else {
  console.warn('Warning: invite/dist/index.html not found — run "npm run build:invite" first');
}

// Copy restore app (single-file HTML)
const restoreSrc = resolve(RESTORE_DIST, 'index.html');
if (existsSync(restoreSrc)) {
  const restoreDir = resolve(DOCS, 'restore');
  mkdirSync(restoreDir, { recursive: true });
  copyFileSync(restoreSrc, resolve(restoreDir, 'index.html'));
  console.log('Copied: restore/index.html → docs/restore/');
} else {
  console.warn('Warning: restore/dist/index.html not found — run "npm run build:restore" first');
}

console.log('\nDone. Next steps:');
console.log('  1. Run "npm run generate-qr" to update QR codes');
console.log('  2. Commit and push');
