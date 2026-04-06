/**
 * Assemble the hiveinvite.com static site for deployment.
 *
 * Copies the landing page and invite app build into a single output directory
 * ready to push to the hiveinvite.com GitHub Pages repo.
 *
 * Usage:
 *   npx tsx deploy-hiveinvite.ts [--output <dir>]
 *
 * Default output: ../hiveinvite-site/dist/
 *
 * Output structure:
 *   CNAME              — custom domain file for GitHub Pages
 *   index.html         — landing page
 *   invite/index.html  — invite claim app (from invite/ build)
 *   restore/index.html — backup restore app (from restore/ build)
 */

import { copyFileSync, cpSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LANDING_PAGE = resolve(ROOT, 'hiveinvite-site', 'index.html');
const INVITE_DIST = resolve(ROOT, 'invite', 'dist');
const RESTORE_DIST = resolve(ROOT, 'restore', 'dist');

// Parse --output flag
const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const OUTPUT = outputIdx >= 0 && args[outputIdx + 1]
  ? resolve(args[outputIdx + 1])
  : resolve(ROOT, 'hiveinvite-site', 'dist');

// Create output directories
mkdirSync(resolve(OUTPUT, 'invite'), { recursive: true });
mkdirSync(resolve(OUTPUT, 'restore'), { recursive: true });

// 1. CNAME
writeFileSync(resolve(OUTPUT, 'CNAME'), 'hiveinvite.com\n');
console.log('Wrote: CNAME');

// 2. Landing page
if (!existsSync(LANDING_PAGE)) {
  console.error('Error: hiveinvite-site/index.html not found');
  process.exit(1);
}
copyFileSync(LANDING_PAGE, resolve(OUTPUT, 'index.html'));
console.log('Copied: index.html (landing page)');

// 3. Invite app — try standard variant first, fall back to default dist/index.html
const inviteStandard = resolve(INVITE_DIST, 'standard', 'index.html');
const inviteDefault = resolve(INVITE_DIST, 'index.html');
const inviteSrc = existsSync(inviteStandard) ? inviteStandard
  : existsSync(inviteDefault) ? inviteDefault
  : null;

if (inviteSrc) {
  copyFileSync(inviteSrc, resolve(OUTPUT, 'invite', 'index.html'));
  console.log(`Copied: invite/index.html (from ${inviteSrc.replace(ROOT, '.')})`);
} else {
  console.warn('Warning: invite app build not found — run "cd invite && npm run build" first');
}

// 3b. Locale-specific invite builds (e.g., dist/standard/index-es.html → invite/es/index.html)
const standardDir = resolve(INVITE_DIST, 'standard');
if (existsSync(standardDir)) {
  for (const file of readdirSync(standardDir)) {
    const match = file.match(/^index-([a-z]{2})\.html$/);
    if (match) {
      const locale = match[1];
      const localeDir = resolve(OUTPUT, 'invite', locale);
      mkdirSync(localeDir, { recursive: true });
      copyFileSync(resolve(standardDir, file), resolve(localeDir, 'index.html'));
      console.log(`Copied: invite/${locale}/index.html (from ./invite/dist/standard/${file})`);
    }
  }
}

// 4. Restore app — default (English) build
const restoreEnLocale = resolve(RESTORE_DIST, 'restore-en.html');
const restoreDefault = resolve(RESTORE_DIST, 'index.html');
const restoreSrc = existsSync(restoreEnLocale) ? restoreEnLocale
  : existsSync(restoreDefault) ? restoreDefault
  : null;

if (restoreSrc) {
  copyFileSync(restoreSrc, resolve(OUTPUT, 'restore', 'index.html'));
  console.log(`Copied: restore/index.html (from ${restoreSrc.replace(ROOT, '.')})`);
} else {
  console.warn('Warning: restore app build not found — run "cd restore && npm run build" first');
}

// 4b. Locale-specific restore builds (e.g., dist/restore-es.html → restore/es/index.html)
if (existsSync(RESTORE_DIST)) {
  for (const file of readdirSync(RESTORE_DIST)) {
    const match = file.match(/^restore-([a-z]{2})\.html$/);
    if (match && match[1] !== 'en') {
      const locale = match[1];
      const localeDir = resolve(OUTPUT, 'restore', locale);
      mkdirSync(localeDir, { recursive: true });
      copyFileSync(resolve(RESTORE_DIST, file), resolve(localeDir, 'index.html'));
      console.log(`Copied: restore/${locale}/index.html (from ./restore/dist/${file})`);
    }
  }
}

// 5. Dashboard app (multi-file Vite build — copy entire dist directory)
const dashboardDist = resolve(ROOT, 'dashboard', 'dist');
if (existsSync(dashboardDist)) {
  cpSync(dashboardDist, resolve(OUTPUT, 'dashboard'), { recursive: true });
  console.log('Copied: dashboard/ (multi-file build)');
} else {
  console.warn('Warning: dashboard app build not found — run "cd dashboard && npm run build" first');
}

console.log(`\nSite assembled in: ${OUTPUT}`);
console.log('\nNext steps:');
console.log('  1. Copy contents to your hiveinvite.com GitHub Pages repo');
console.log('  2. Commit and push');
