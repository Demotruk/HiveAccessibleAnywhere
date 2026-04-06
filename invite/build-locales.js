import { execSync } from 'child_process';
import { renameSync, mkdirSync, existsSync } from 'fs';

const LOCALES = ['en', 'es'];
const VARIANTS = ['standard', 'robust'];

for (const variant of VARIANTS) {
  const outDir = variant === 'robust' ? 'dist/robust' : 'dist/standard';
  mkdirSync(outDir, { recursive: true });

  for (const locale of LOCALES) {
    console.log(`\nBuilding ${variant}/${locale} invite...`);
    execSync(`npx vite build --emptyOutDir false`, {
      env: { ...process.env, LOCALE: locale, VARIANT: variant },
      stdio: 'inherit',
    });
    if (locale !== 'en') {
      const src = `${outDir}/index.html`;
      const dest = `${outDir}/index-${locale}.html`;
      if (existsSync(src)) {
        renameSync(src, dest);
      }
    }
  }
}

console.log('\nDone! Built invite locales:');
for (const variant of VARIANTS) {
  const outDir = variant === 'robust' ? 'dist/robust' : 'dist/standard';
  for (const locale of LOCALES) {
    const file = locale === 'en' ? `${outDir}/index.html` : `${outDir}/index-${locale}.html`;
    console.log(`  ${file}`);
  }
}
