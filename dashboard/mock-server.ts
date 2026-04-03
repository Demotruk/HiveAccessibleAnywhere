/**
 * Mock giftcard service for dashboard development.
 * Fakes auth + batch API endpoints with realistic data.
 *
 * Usage: npx tsx mock-server.ts
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 3200;
const JWT_TOKEN = 'mock-jwt-' + randomBytes(16).toString('hex');
const MOCK_USER = 'demotruktest27'; // default/seed user
const ADMIN_USER = 'haa-giftcard';
let currentUser = MOCK_USER; // tracks the last-authenticated user

// In-memory batch store
interface MockBatch {
  id: string;
  createdAt: string;
  expiresAt: string;
  count: number;
  promiseType: string;
  declarationTx: string;
  merkleRoot: string;
  note: string | null;
  provider: string;
  cards: { tokenPrefix: string; status: string; claimedBy: string | null; claimedAt: string | null }[];
}

const batches: MockBatch[] = [];

// Seed some sample batches
function seedBatches() {
  const now = new Date();
  const batch1Id = `batch-${Date.now() - 86400000}-ab12cd`;
  const batch2Id = `batch-${Date.now() - 172800000}-ef34gh`;

  batches.push({
    id: batch1Id,
    createdAt: new Date(now.getTime() - 86400000).toISOString(),
    expiresAt: new Date(now.getTime() + 364 * 86400000).toISOString(),
    count: 5,
    promiseType: 'account-creation',
    declarationTx: randomBytes(20).toString('hex'),
    merkleRoot: randomBytes(32).toString('hex'),
    note: 'First test batch',
    provider: MOCK_USER,
    cards: [
      { tokenPrefix: randomBytes(4).toString('hex'), status: 'spent', claimedBy: 'alice', claimedAt: new Date(now.getTime() - 43200000).toISOString() },
      { tokenPrefix: randomBytes(4).toString('hex'), status: 'spent', claimedBy: 'bob', claimedAt: new Date(now.getTime() - 36000000).toISOString() },
      { tokenPrefix: randomBytes(4).toString('hex'), status: 'active', claimedBy: null, claimedAt: null },
      { tokenPrefix: randomBytes(4).toString('hex'), status: 'active', claimedBy: null, claimedAt: null },
      { tokenPrefix: randomBytes(4).toString('hex'), status: 'revoked', claimedBy: null, claimedAt: null },
    ],
  });

  batches.push({
    id: batch2Id,
    createdAt: new Date(now.getTime() - 172800000).toISOString(),
    expiresAt: new Date(now.getTime() + 363 * 86400000).toISOString(),
    count: 3,
    promiseType: 'account-creation',
    declarationTx: randomBytes(20).toString('hex'),
    merkleRoot: randomBytes(32).toString('hex'),
    note: null,
    provider: MOCK_USER,
    cards: [
      { tokenPrefix: randomBytes(4).toString('hex'), status: 'active', claimedBy: null, claimedAt: null },
      { tokenPrefix: randomBytes(4).toString('hex'), status: 'active', claimedBy: null, claimedAt: null },
      { tokenPrefix: randomBytes(4).toString('hex'), status: 'active', claimedBy: null, claimedAt: null },
    ],
  });
}

seedBatches();

// In-memory issuer store
interface MockIssuer {
  username: string;
  status: 'pending' | 'approved' | 'active';
  description: string | null;
  contact: string | null;
  applied_at: string;
  apply_tx_id: string | null;
  approved_at: string | null;
  approve_tx_id: string | null;
  delegation_verified_at: string | null;
  service_url: string | null;
  batch_count: number;
  total_cards: number;
  claimed_cards: number;
}

const issuers: MockIssuer[] = [
  {
    username: 'pendinguser',
    status: 'pending',
    description: 'I want to onboard my local crypto meetup group.',
    contact: '@pendinguser on Telegram',
    applied_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    apply_tx_id: randomBytes(20).toString('hex'),
    approved_at: null,
    approve_tx_id: null,
    delegation_verified_at: null,
    service_url: null,
    batch_count: 0,
    total_cards: 0,
    claimed_cards: 0,
  },
  {
    username: 'approveduser',
    status: 'pending',
    description: 'Running a Hive workshop at ETHDenver.',
    contact: 'Discord: approveduser#1234',
    applied_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    apply_tx_id: randomBytes(20).toString('hex'),
    approved_at: null,
    approve_tx_id: null,
    delegation_verified_at: null,
    service_url: null,
    batch_count: 0,
    total_cards: 0,
    claimed_cards: 0,
  },
];

// Make MOCK_USER an active issuer
issuers.push({
  username: MOCK_USER,
  status: 'active',
  description: 'Test issuer account',
  contact: null,
  applied_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  apply_tx_id: randomBytes(20).toString('hex'),
  approved_at: new Date(Date.now() - 29 * 86400000).toISOString(),
  approve_tx_id: randomBytes(20).toString('hex'),
  delegation_verified_at: new Date(Date.now() - 28 * 86400000).toISOString(),
  service_url: null,
  batch_count: batches.length,
  total_cards: batches.reduce((s, b) => s + b.count, 0),
  claimed_cards: batches.reduce((s, b) => s + b.cards.filter(c => c.status === 'spent').length, 0),
});

function getRole(username: string): 'admin' | 'issuer' | 'applicant' {
  if (username === ADMIN_USER) return 'admin';
  const issuer = issuers.find(i => i.username === username);
  if (issuer?.status === 'active') return 'issuer';
  return 'applicant';
}

// Helpers
function json(res: import('node:http').ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
  res.end(JSON.stringify(data));
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk; });
    req.on('end', () => resolve(data));
  });
}

function checkAuth(req: import('node:http').IncomingMessage): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${JWT_TOKEN}`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method!;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  try {
    // POST /auth/challenge
    if (method === 'POST' && path === '/auth/challenge') {
      const body = JSON.parse(await readBody(req));
      const username = (body.username || '').toLowerCase().trim();
      if (!username) return json(res, { error: 'Missing username' }, 400);
      console.log(`[AUTH] Challenge requested for @${username}`);
      return json(res, { challenge: randomBytes(32).toString('hex') });
    }

    // POST /auth/verify — accepts any signature in mock mode
    if (method === 'POST' && path === '/auth/verify') {
      const body = JSON.parse(await readBody(req));
      const username = (body.username || '').toLowerCase().trim();
      if (!username || !body.challenge || !body.signature) {
        return json(res, { error: 'Missing username, challenge, or signature' }, 400);
      }
      currentUser = username;
      console.log(`[AUTH] Verified @${username} (mock — any signature accepted)`);
      return json(res, { token: JWT_TOKEN });
    }

    // POST /api/batches — generate batch
    if (method === 'POST' && path === '/api/batches') {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const body = JSON.parse(await readBody(req));
      const count = body.count || 10;
      const batchId = `batch-${Date.now()}-${randomBytes(3).toString('hex')}`;
      const now = new Date();
      const expiryDays = body.expiryDays || 365;

      const cards = Array.from({ length: count }, () => ({
        tokenPrefix: randomBytes(4).toString('hex'),
        status: 'active',
        claimedBy: null,
        claimedAt: null,
      }));

      const batch: MockBatch = {
        id: batchId,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + expiryDays * 86400000).toISOString(),
        count,
        promiseType: 'account-creation',
        declarationTx: randomBytes(20).toString('hex'),
        merkleRoot: randomBytes(32).toString('hex'),
        note: body.note || null,
        provider: MOCK_USER,
        cards,
      };
      batches.unshift(batch);

      console.log(`[BATCH] Generated ${count} cards → ${batchId}`);

      // Simulate generation delay
      await new Promise(r => setTimeout(r, 1500));

      return json(res, {
        batchId,
        count,
        expiresAt: batch.expiresAt,
        merkleRoot: batch.merkleRoot,
        declarationTx: batch.declarationTx,
        downloads: {
          pdf: `/api/batches/${batchId}/pdf`,
          manifest: `/api/batches/${batchId}/manifest`,
        },
      });
    }

    // GET /api/batches — list
    if (method === 'GET' && path === '/api/batches') {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const result = batches.map(b => ({
        batchId: b.id,
        createdAt: b.createdAt,
        expiresAt: b.expiresAt,
        count: b.count,
        promiseType: b.promiseType,
        declarationTx: b.declarationTx,
        merkleRoot: b.merkleRoot,
        note: b.note,
        status: {
          active: b.cards.filter(c => c.status === 'active').length,
          spent: b.cards.filter(c => c.status === 'spent').length,
          revoked: b.cards.filter(c => c.status === 'revoked').length,
        },
      }));
      return json(res, { batches: result });
    }

    // GET /api/batches/:id
    const detailMatch = path.match(/^\/api\/batches\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const batch = batches.find(b => b.id === detailMatch[1]);
      if (!batch) return json(res, { error: 'Batch not found' }, 404);
      return json(res, {
        batchId: batch.id,
        createdAt: batch.createdAt,
        expiresAt: batch.expiresAt,
        count: batch.count,
        promiseType: batch.promiseType,
        declarationTx: batch.declarationTx,
        merkleRoot: batch.merkleRoot,
        note: batch.note,
        cards: batch.cards,
      });
    }

    // GET /api/batches/:id/pdf — fake PDF
    const pdfMatch = path.match(/^\/api\/batches\/([^/]+)\/pdf$/);
    if (method === 'GET' && pdfMatch) {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const batch = batches.find(b => b.id === pdfMatch[1]);
      if (!batch) return json(res, { error: 'PDF not found' }, 404);
      const content = `Mock PDF for batch ${batch.id}\n${batch.count} cards\nGenerated: ${batch.createdAt}`;
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${batch.id}.pdf"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end(content);
      return;
    }

    // GET /api/batches/:id/manifest — fake manifest
    const manifestMatch = path.match(/^\/api\/batches\/([^/]+)\/manifest$/);
    if (method === 'GET' && manifestMatch) {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const batch = batches.find(b => b.id === manifestMatch[1]);
      if (!batch) return json(res, { error: 'Manifest not found' }, 404);
      const manifest = {
        batchId: batch.id,
        provider: batch.provider,
        createdAt: batch.createdAt,
        cards: batch.cards.map((c, i) => ({
          index: i + 1,
          tokenPrefix: c.tokenPrefix,
          token: randomBytes(32).toString('hex'),
          pin: 'ABC123',
        })),
      };
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${batch.id}-manifest.json"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end(JSON.stringify(manifest, null, 2));
      return;
    }

    // POST /api/issuers/apply
    if (method === 'POST' && path === '/api/issuers/apply') {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const body = JSON.parse(await readBody(req));
      const existing = issuers.find(i => i.username === currentUser);
      if (existing) return json(res, { issuer: existing });
      const issuer: MockIssuer = {
        username: currentUser,
        status: 'pending',
        description: body.description || 'Mock application',
        contact: body.contact || null,
        applied_at: new Date().toISOString(),
        apply_tx_id: body.txId || randomBytes(20).toString('hex'),
        approved_at: null, approve_tx_id: null, delegation_verified_at: null, service_url: null,
        batch_count: 0, total_cards: 0, claimed_cards: 0,
      };
      issuers.push(issuer);
      console.log(`[ISSUER] Application from @${currentUser}`);
      return json(res, { issuer }, 201);
    }

    // POST /api/issuers/me/service-url
    if (method === 'POST' && path === '/api/issuers/me/service-url') {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const body = JSON.parse(await readBody(req));
      const issuer = issuers.find(i => i.username === currentUser);
      if (!issuer) return json(res, { error: 'No issuer record found' }, 404);
      if (issuer.status === 'pending') return json(res, { error: 'Must be approved first' }, 400);
      issuer.service_url = body.serviceUrl ?? null;
      // Auto-activate if approved and URL provided
      if (issuer.status === 'approved' && issuer.service_url) {
        issuer.status = 'active';
        issuer.delegation_verified_at = new Date().toISOString();
        console.log(`[ISSUER] @${currentUser} auto-activated (external service URL)`);
      }
      console.log(`[ISSUER] @${currentUser} service URL set to: ${issuer.service_url}`);
      return json(res, { issuer });
    }

    // GET /api/issuers/me
    if (method === 'GET' && path === '/api/issuers/me') {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const username = currentUser;
      const issuer = issuers.find(i => i.username === username) || null;
      const role = getRole(username);
      const setupStatus = issuer && (issuer.status === 'approved' || issuer.status === 'active')
        ? { delegated: issuer.status === 'active', pendingTokens: 42 }
        : null;
      return json(res, { issuer, role, setupStatus });
    }

    // GET /api/admin/issuers
    if (method === 'GET' && path === '/api/admin/issuers') {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const status = url.searchParams.get('status');
      const result = status ? issuers.filter(i => i.status === status) : issuers;
      return json(res, { issuers: result });
    }

    // POST /api/admin/issuers/:username/approve
    const approveMatch = path.match(/^\/api\/admin\/issuers\/([^/]+)\/approve$/);
    if (method === 'POST' && approveMatch) {
      if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);
      const username = approveMatch[1].toLowerCase();
      const issuer = issuers.find(i => i.username === username);
      if (!issuer) return json(res, { error: 'Not found' }, 404);
      if (issuer.status !== 'pending') return json(res, { error: `Already ${issuer.status}` }, 400);
      issuer.status = 'approved';
      issuer.approved_at = new Date().toISOString();
      issuer.approve_tx_id = randomBytes(20).toString('hex');
      console.log(`[ISSUER] @${username} approved`);
      return json(res, { issuer });
    }

    // GET /health
    if (method === 'GET' && path === '/health') {
      return json(res, { status: 'ok (mock)' });
    }

    json(res, { error: 'Not found' }, 404);
  } catch (err) {
    console.error('[ERROR]', err);
    json(res, { error: 'Internal server error' }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Mock giftcard service running on http://localhost:${PORT}`);
  console.log(`  Pre-seeded with ${batches.length} batches`);
  console.log(`  Any username + any Keychain signature will authenticate\n`);
});
