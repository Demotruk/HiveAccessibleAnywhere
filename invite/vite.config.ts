import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Use shared dev cert if available, otherwise fall back to basicSsl auto-generated.
// Check both repo location (../.claude/certs) and haa-local workspace (../certs).
const repoCertDir = resolve(__dirname, '../.claude/certs');
const localCertDir = resolve(__dirname, '../certs');
const certDir = existsSync(resolve(repoCertDir, 'dev-cert.pem')) ? repoCertDir
  : existsSync(resolve(localCertDir, 'dev-cert.pem')) ? localCertDir : repoCertDir;
const hasCerts = existsSync(resolve(certDir, 'dev-cert.pem'));

const variant = (process.env.VARIANT || 'standard') as 'standard' | 'robust';

export default defineConfig({
  plugins: [
    viteSingleFile(),
    // Self-signed HTTPS for LAN dev (required for Web Crypto API on non-localhost)
    ...(process.env.HTTPS_DEV && !hasCerts ? [basicSsl()] : []),
  ],
  define: {
    __VARIANT__: JSON.stringify(variant),
  },
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
    outDir: variant === 'robust' ? 'dist/robust' : 'dist/standard',
    minify: 'esbuild',
    reportCompressedSize: true,
  },
});
