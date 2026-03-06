import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

const locale = process.env.LOCALE || 'en';
const phase = parseInt(process.env.PHASE || '1');

export default defineConfig({
  plugins: [viteSingleFile()],
  define: {
    __PHASE__: JSON.stringify(phase),
  },
  server: {
    port: parseInt(process.env.PORT || '5174'),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    minify: 'esbuild',
    reportCompressedSize: true,
  },
  resolve: {
    alias: locale !== 'en' ? [
      {
        find: /^\.\/locales\/en$/,
        replacement: fileURLToPath(new URL(`./src/ui/locales/${locale}.ts`, import.meta.url)),
      },
    ] : [],
  },
});
