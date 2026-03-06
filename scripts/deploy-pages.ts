/**
 * Copy bootstrap HTML files from wallet/dist/ into docs/ for GitHub Pages.
 *
 * Usage:
 *   npx tsx deploy-pages.ts
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'wallet', 'dist');
const DOCS = resolve(ROOT, 'docs');

const LOCALES = ['en', 'zh'];

mkdirSync(DOCS, { recursive: true });

for (const locale of LOCALES) {
  const src = resolve(DIST, `propolis-bootstrap-${locale}.html`);
  const dest = resolve(DOCS, `propolis-bootstrap-${locale}.html`);
  copyFileSync(src, dest);
  console.log(`Copied: propolis-bootstrap-${locale}.html → docs/`);
}

console.log('\nDone. Next steps:');
console.log('  1. Run "npm run generate-qr" to update QR codes');
console.log('  2. Commit and push');
