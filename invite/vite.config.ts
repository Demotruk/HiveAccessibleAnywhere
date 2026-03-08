import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Use shared dev cert if available, otherwise fall back to basicSsl auto-generated
const certDir = resolve(__dirname, '../.claude/certs');
const hasCerts = existsSync(resolve(certDir, 'dev-cert.pem'));

export default defineConfig({
  plugins: [
    viteSingleFile(),
    // Self-signed HTTPS for LAN dev (required for Web Crypto API on non-localhost)
    ...(process.env.HTTPS_DEV && !hasCerts ? [basicSsl()] : []),
  ],
  server: {
    port: parseInt(process.env.PORT || '5175'),
    ...(process.env.HTTPS_DEV && hasCerts ? {
      https: {
        cert: readFileSync(resolve(certDir, 'dev-cert.pem')),
        key: readFileSync(resolve(certDir, 'dev-key.pem')),
      },
    } : {}),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    minify: 'esbuild',
    reportCompressedSize: true,
  },
});
