/**
 * HAA Gift Card Service.
 *
 * Creates Hive accounts from single-use claim tokens distributed
 * via QR-code gift cards. Separate from the RPC proxy for security
 * isolation — this service holds account creation keys.
 *
 * Architecture:
 * - GET /         → Cover site (looks like a blog)
 * - POST /claim   → Redeem a claim token to create a Hive account
 * - POST /validate→ Pre-flight check if a token is valid
 * - GET /health   → Health check endpoint
 *
 * Security:
 * - Helmet for HTTP headers
 * - CORS for cross-origin wallet requests
 * - Aggressive rate limiting on claim endpoint
 * - All claim attempts are audit-logged
 * - Private keys never received — only public keys from wallet
 */

import express from 'express';
import helmet from 'helmet';
import https from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { rateLimit } from './middleware/rate-limit.js';
import { serveCoverPage, getThemeName } from './cover-site.js';
import { claimHandler } from './routes/claim.js';
import { validateHandler } from './routes/validate.js';
import { loadConfig } from './config.js';
import { initDatabase } from './db.js';
import { warmBatchCache } from './hive/batch-lookup.js';

const config = loadConfig();
const db = initDatabase(config.dbPath);

// Pre-warm the batch declaration cache at startup.
// Scans the most recent 10k entries of provider history to cache any
// batch declarations. This runs async so it doesn't block server start,
// and ensures the first /claim doesn't have to wait for Hive RPC calls.
console.log(`[STARTUP] Pre-warming batch cache for @${config.providerAccount}...`);
const warmStart = Date.now();
warmBatchCache(config.providerAccount, config.hiveNodes)
  .then(() => console.log(`[STARTUP] Batch cache warm in ${Date.now() - warmStart}ms`))
  .catch((err) => console.error(`[STARTUP] Batch cache warm-up failed after ${Date.now() - warmStart}ms: ${err instanceof Error ? err.message : String(err)}`));

const app = express();

// Security headers (relaxed CSP for cover site)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS — allow wallet requests from any origin
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Parse JSON bodies (small limit — claim payloads are tiny)
app.use(express.json({ limit: '16kb' }));

// Rate limiters — aggressive on claim, moderate on validate
const claimLimiter = rateLimit({ max: 10, windowMs: 60_000 });
const validateLimiter = rateLimit({ max: 30, windowMs: 60_000 });

// --- Routes ---

// Cover site — what visitors see in a browser
app.get('/', serveCoverPage);

// Token validation (pre-flight check)
app.post('/validate', validateLimiter, validateHandler(db, config));

// Account creation (core endpoint)
app.post('/claim', claimLimiter, claimHandler(db, config));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 404 for everything else (looks like a normal site)
app.use((_req, res) => {
  res.status(404).type('html').send(
    '<html><body><h1>404</h1><p>Page not found.</p></body></html>'
  );
});

// HTTPS support for local dev (required for Web Crypto on LAN)
const certPath = process.env.GIFTCARD_TLS_CERT;
const keyPath = process.env.GIFTCARD_TLS_KEY;
const useHttps = certPath && keyPath && existsSync(certPath) && existsSync(keyPath);

if (useHttps) {
  const tlsOptions = {
    cert: readFileSync(certPath!),
    key: readFileSync(keyPath!),
  };
  https.createServer(tlsOptions, app).listen(config.port, '0.0.0.0', () => {
    console.log(`HAA Gift Card Service (HTTPS) listening on port ${config.port} [provider: @${config.providerAccount}, theme: ${getThemeName()}]`);
    console.log(`Cover site: https://localhost:${config.port}/`);
    console.log(`Claim:      POST https://localhost:${config.port}/claim`);
    console.log(`Validate:   POST https://localhost:${config.port}/validate`);
    console.log(`Health:     https://localhost:${config.port}/health`);
    console.log(`Database:   ${config.dbPath}`);
  });
} else {
  app.listen(config.port, () => {
    console.log(`HAA Gift Card Service listening on port ${config.port} [provider: @${config.providerAccount}, theme: ${getThemeName()}]`);
    console.log(`Cover site: http://localhost:${config.port}/`);
    console.log(`Claim:      POST http://localhost:${config.port}/claim`);
    console.log(`Validate:   POST http://localhost:${config.port}/validate`);
    console.log(`Health:     http://localhost:${config.port}/health`);
    console.log(`Database:   ${config.dbPath}`);
  });
}
