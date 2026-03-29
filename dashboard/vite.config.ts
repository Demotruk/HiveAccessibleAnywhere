import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dashboard/',
  define: {
    '__API_BASE__': JSON.stringify(process.env.API_BASE || ''),
  },
  server: {
    port: parseInt(process.env.PORT || '5179'),
    proxy: {
      '/auth': 'http://localhost:3200',
      '/api': 'http://localhost:3200',
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    minify: 'esbuild',
    reportCompressedSize: true,
  },
});
