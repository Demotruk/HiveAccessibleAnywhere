import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  server: {
    port: parseInt(process.env.PORT || '5177'),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    minify: 'esbuild',
    reportCompressedSize: true,
  },
});
