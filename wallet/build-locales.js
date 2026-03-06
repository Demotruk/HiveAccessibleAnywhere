import { execSync } from 'child_process';
import { renameSync, rmSync, mkdirSync } from 'fs';

// Clean dist once, then build without Vite re-cleaning
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

for (const locale of ['en', 'zh']) {
  console.log(`\nBuilding ${locale} wallet...`);
  execSync('npx vite build --emptyOutDir false', {
    env: { ...process.env, LOCALE: locale },
    stdio: 'inherit',
  });
  renameSync('dist/index.html', `dist/haa-wallet-${locale}.html`);
}

console.log('\nDone! Built:');
console.log('  dist/haa-wallet-en.html');
console.log('  dist/haa-wallet-zh.html');
