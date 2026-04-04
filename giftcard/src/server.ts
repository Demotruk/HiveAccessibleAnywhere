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
import { requireAuth, requireIssuer, requireAdmin } from './middleware/auth.js';
import { serveCoverPage, getThemeName } from './cover-site.js';
import { claimHandler } from './routes/claim.js';
import { validateHandler } from './routes/validate.js';
import { challengeHandler, verifyHandler } from './routes/auth.js';
import {
  createBatchHandler, prepareBatchHandler, finalizeBatchHandler,
  listBatchesHandler, getBatchDetailHandler,
  downloadPdfHandler, downloadManifestHandler,
} from './routes/batches.js';
import {
  applyHandler, meHandler, setServiceUrlHandler, listIssuersHandler, approveHandler,
} from './routes/issuers.js';
import { loadConfig, isMultiTenant } from './config.js';
import { initDatabase, cleanupPendingBatches } from './db.js';
import { warmBatchCache } from './hive/batch-lookup.js';

const config = loadConfig();
const db = initDatabase(config.dbPath);

// Log operating mode
if (isMultiTenant(config)) {
  const providerCount = config.allowedProviders?.size ?? 0;
  console.log(`[STARTUP] Multi-tenant mode: service account @${config.serviceAccount}, ${providerCount} allowed provider(s)`);
  if (config.allowedProviders) {
    console.log(`[STARTUP] Allowed providers: ${[...config.allowedProviders].join(', ')}`);
  }
} else {
  console.log(`[STARTUP] Single-tenant mode: provider @${config.providerAccount}`);
}

// Pre-warm the batch declaration cache at startup.
// In single-tenant mode, warms the default provider.
// In multi-tenant mode, warms all allowed providers.
const warmStart = Date.now();
const providersToWarm = isMultiTenant(config) && config.allowedProviders
  ? [...config.allowedProviders]
  : [config.providerAccount];

for (const provider of providersToWarm) {
  console.log(`[STARTUP] Pre-warming batch cache for @${provider}...`);
  warmBatchCache(provider, config.hiveNodes)
    .then(() => console.log(`[STARTUP] Batch cache warm for @${provider} in ${Date.now() - warmStart}ms`))
    .catch((err) => console.error(`[STARTUP] Batch cache warm-up for @${provider} failed: ${err instanceof Error ? err.message : String(err)}`));
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Parse JSON bodies (small limit — claim payloads are tiny)
app.use(express.json({ limit: '16kb' }));

// Rate limiters — aggressive on claim, moderate on validate and auth
const claimLimiter = rateLimit({ max: 10, windowMs: 60_000 });
const validateLimiter = rateLimit({ max: 30, windowMs: 60_000 });
const authLimiter = rateLimit({ max: 20, windowMs: 60_000 });
const apiLimiter = rateLimit({ max: 30, windowMs: 60_000 });

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

// --- Dashboard API ---

// Auth routes (public, rate-limited)
app.post('/auth/challenge', authLimiter, challengeHandler(config));
app.post('/auth/verify', authLimiter, verifyHandler(config));

// Issuer routes (any authenticated user)
const auth = requireAuth(config, db);
app.post('/api/issuers/apply', apiLimiter, auth, applyHandler(db));
app.get('/api/issuers/me', apiLimiter, auth, meHandler(db, config));
app.post('/api/issuers/me/service-url', apiLimiter, auth, setServiceUrlHandler(db));

// Admin routes
const admin = requireAdmin(config, db);
app.get('/api/admin/issuers', apiLimiter, admin, listIssuersHandler(db));
app.post('/api/admin/issuers/:username/approve', apiLimiter, admin, approveHandler(db, config));

// Batch routes (active issuers + admins)
const issuer = requireIssuer(config, db);
app.post('/api/batches/prepare', apiLimiter, issuer, prepareBatchHandler(db, config));
app.post('/api/batches', apiLimiter, issuer, createBatchHandler(db, config));
app.get('/api/batches', apiLimiter, issuer, listBatchesHandler(db));
app.post('/api/batches/:id/finalize', apiLimiter, issuer, finalizeBatchHandler(db, config));
app.get('/api/batches/:id/pdf', apiLimiter, issuer, downloadPdfHandler(db));
app.get('/api/batches/:id/manifest', apiLimiter, issuer, downloadManifestHandler(db));
app.get('/api/batches/:id', apiLimiter, issuer, getBatchDetailHandler(db));

// Clean up abandoned pending batches every 15 minutes
setInterval(() => cleanupPendingBatches(db), 15 * 60 * 1000);

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
    const mode = isMultiTenant(config) ? `multi-tenant, service: @${config.serviceAccount}` : `provider: @${config.providerAccount}`;
    console.log(`HAA Gift Card Service (HTTPS) listening on port ${config.port} [${mode}, theme: ${getThemeName()}]`);
    console.log(`Cover site: https://localhost:${config.port}/`);
    console.log(`Claim:      POST https://localhost:${config.port}/claim`);
    console.log(`Validate:   POST https://localhost:${config.port}/validate`);
    console.log(`Health:     https://localhost:${config.port}/health`);
    console.log(`Auth:       POST https://localhost:${config.port}/auth/challenge`);
    console.log(`            POST https://localhost:${config.port}/auth/verify`);
    console.log(`Batches:    POST https://localhost:${config.port}/api/batches`);
    console.log(`            GET  https://localhost:${config.port}/api/batches`);
    console.log(`Database:   ${config.dbPath}`);
  });
} else {
  app.listen(config.port, () => {
    const mode = isMultiTenant(config) ? `multi-tenant, service: @${config.serviceAccount}` : `provider: @${config.providerAccount}`;
    console.log(`HAA Gift Card Service listening on port ${config.port} [${mode}, theme: ${getThemeName()}]`);
    console.log(`Cover site: http://localhost:${config.port}/`);
    console.log(`Claim:      POST http://localhost:${config.port}/claim`);
    console.log(`Validate:   POST http://localhost:${config.port}/validate`);
    console.log(`Health:     http://localhost:${config.port}/health`);
    console.log(`Auth:       POST http://localhost:${config.port}/auth/challenge`);
    console.log(`            POST http://localhost:${config.port}/auth/verify`);
    console.log(`Batches:    POST http://localhost:${config.port}/api/batches`);
    console.log(`            GET  http://localhost:${config.port}/api/batches`);
    console.log(`Database:   ${config.dbPath}`);
  });
}
