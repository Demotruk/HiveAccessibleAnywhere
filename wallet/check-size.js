import { readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distFile = join(__dirname, 'dist', 'index.html');
const MAX_SIZE = 100 * 1024; // 100KB

try {
  const stats = statSync(distFile);
  const sizeKB = (stats.size / 1024).toFixed(1);

  if (stats.size > MAX_SIZE) {
    console.error(`\x1b[31m✗ Build output too large: ${sizeKB}KB (max: ${MAX_SIZE / 1024}KB)\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✓ Build output: ${sizeKB}KB (max: ${MAX_SIZE / 1024}KB)\x1b[0m`);
  }
} catch (e) {
  console.error('Could not read dist/index.html — did you run `npm run build` first?');
  process.exit(1);
}
