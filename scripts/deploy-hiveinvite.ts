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
 */

import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LANDING_PAGE = resolve(ROOT, 'hiveinvite-site', 'index.html');
const INVITE_DIST = resolve(ROOT, 'invite', 'dist');

// Parse --output flag
const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const OUTPUT = outputIdx >= 0 && args[outputIdx + 1]
  ? resolve(args[outputIdx + 1])
  : resolve(ROOT, 'hiveinvite-site', 'dist');

// Create output directories
mkdirSync(resolve(OUTPUT, 'invite'), { recursive: true });

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

console.log(`\nSite assembled in: ${OUTPUT}`);
console.log('\nNext steps:');
console.log('  1. Copy contents to your hiveinvite.com GitHub Pages repo');
console.log('  2. Commit and push');
