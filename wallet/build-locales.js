import { execSync } from 'child_process';
import { renameSync, rmSync, mkdirSync } from 'fs';

// Clean dist once, then build without Vite re-cleaning
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const LOCALES = ['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi'];

for (const locale of LOCALES) {
  console.log(`\nBuilding ${locale} wallet...`);
  execSync('npx vite build --emptyOutDir false', {
    env: { ...process.env, LOCALE: locale },
    stdio: 'inherit',
  });
  renameSync('dist/index.html', `dist/propolis-wallet-${locale}.html`);
}

console.log('\nDone! Built:');
for (const locale of LOCALES) {
  console.log(`  dist/propolis-wallet-${locale}.html`);
}
