import { execSync } from 'child_process';
import { renameSync, rmSync, mkdirSync } from 'fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const LOCALES = ['en', 'es'];

for (const locale of LOCALES) {
  console.log(`\nBuilding ${locale} restore app...`);
  execSync('npx vite build --emptyOutDir false', {
    env: { ...process.env, LOCALE: locale },
    stdio: 'inherit',
  });
  renameSync('dist/index.html', `dist/restore-${locale}.html`);
}

console.log('\nDone! Built:');
for (const locale of LOCALES) {
  console.log(`  dist/restore-${locale}.html`);
}
