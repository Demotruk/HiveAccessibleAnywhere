/**
 * HAA RPC Proxy Server.
 *
 * Relays JSON-RPC requests to upstream Hive API nodes.
 * Presents as an ordinary website to casual visitors.
 *
 * Architecture:
 * - GET /         → Cover site (looks like a photography blog)
 * - POST /rpc     → JSON-RPC relay to Hive nodes (method allowlisted)
 * - GET /health   → Health check endpoint
 *
 * Security:
 * - Helmet for HTTP headers
 * - CORS for cross-origin wallet requests
 * - Rate limiting per IP
 * - Method allowlist (no arbitrary RPC calls)
 * - The proxy never sees private keys — only signed transactions
 */

import express from 'express';
import helmet from 'helmet';
import { relayHandler, getAllowedMethods } from './relay.js';
import { serveCoverPage } from './cover-site.js';
import { rateLimit } from './middleware/rate-limit.js';
import { deobfuscateMiddleware } from './deobfuscate.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3100', 10);

// Security headers (relaxed CSP for cover site)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS — allow wallet tool from any origin
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Version');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Parse JSON bodies (for RPC requests)
app.use(express.json({ limit: '1mb' }));

// Rate limiting on the RPC endpoint
const rpcLimiter = rateLimit({ max: 120, windowMs: 60_000 });

// --- Routes ---

// Cover site — what visitors see in a browser
app.get('/', serveCoverPage);

// JSON-RPC relay endpoint (direct)
app.post('/rpc', rpcLimiter, relayHandler);

// Obfuscated relay — accepts POST to /api/:path with X-Api-Version: 1
// Deobfuscates the payload, relays as normal JSON-RPC, re-obfuscates response
app.post('/api/:path', rpcLimiter, deobfuscateMiddleware(), relayHandler);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'haa-proxy',
    methods: getAllowedMethods(),
  });
});

// 404 for everything else (looks like a normal site)
app.use((_req, res) => {
  res.status(404).type('html').send(
    '<html><body><h1>404</h1><p>Page not found.</p></body></html>'
  );
});

app.listen(PORT, () => {
  console.log(`HAA Proxy listening on port ${PORT}`);
  console.log(`Cover site: http://localhost:${PORT}/`);
  console.log(`RPC relay:  http://localhost:${PORT}/rpc`);
  console.log(`Health:     http://localhost:${PORT}/health`);
});
