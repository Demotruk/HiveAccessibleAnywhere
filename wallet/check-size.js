import { statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_SIZE = 170 * 1024; // 170KB (raised from 120KB to accommodate qr-scanner)

const LOCALES = ['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi', 'es'];

// Check both locale builds and the default build
const files = [
  'dist/index.html',
  ...LOCALES.map(l => `dist/propolis-wallet-${l}.html`),
];

let checked = 0;
for (const file of files) {
  const path = join(__dirname, file);
  try {
    const stats = statSync(path);
    const sizeKB = (stats.size / 1024).toFixed(1);
    checked++;
    if (stats.size > MAX_SIZE) {
      console.error(`\x1b[31m✗ ${file}: ${sizeKB}KB (max: ${MAX_SIZE / 1024}KB)\x1b[0m`);
      process.exit(1);
    } else {
      console.log(`\x1b[32m✓ ${file}: ${sizeKB}KB (max: ${MAX_SIZE / 1024}KB)\x1b[0m`);
    }
  } catch {
    // File doesn't exist, skip
  }
}

if (!checked) {
  console.error('No build output found — did you run `npm run build` or `npm run build:all` first?');
  process.exit(1);
}
