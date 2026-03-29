# Gift Card Service

An Express server that redeems single-use claim tokens to create Hive accounts and provides a dashboard API for issuer batch management. Deployed separately from the proxy for security isolation — this service holds account creation keys.

## Architecture

```
src/
  server.ts           # Express app, routes, startup
  config.ts           # Environment config, multi-tenant mode detection
  db.ts               # SQLite schema + queries + migrations
  cover-site.ts       # Cover page (blog theme, same pattern as proxy)
  auth/
    challenge.ts      # In-memory challenge store (5-min TTL)
    verify.ts         # Hive posting key signature verification
    jwt.ts            # JWT sign/verify utilities
  middleware/
    rate-limit.ts     # Per-IP rate limiting
    auth.ts           # JWT authentication middleware (requireAuth)
  routes/
    claim.ts          # POST /claim — redeem token → create account
    validate.ts       # POST /validate — pre-flight token check
    auth.ts           # POST /auth/challenge, /auth/verify — Keychain login
    batches.ts        # CRUD for batch management (dashboard API)
  generate/
    batch.ts          # Server-side batch generation pipeline
    declare.ts        # On-chain batch declaration (custom_json)
    pdf.ts            # Invite card PDF generation (pdf-lib)
    design-loader.ts  # Design template loading (v1: Hive design only)
    design-types.ts   # Design config type definitions
  hive/
    account.ts        # Account creation + delegation
    batch-lookup.ts   # On-chain batch declaration cache
    provider.ts       # Provider memo key resolution
  crypto/
    signing.ts        # Token/PIN generation, Merkle tree, encryption
  types/
    express.d.ts      # Express Request augmentation (req.issuer)
assets/
  hive-logo.png       # Hive logo for default card design
```

## Routes

### Core (Gift Card Redemption)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/` | GET | No | Cover site (blog theme) |
| `/claim` | POST | No | Redeem a claim token → create Hive account |
| `/validate` | POST | No | Pre-flight token validation (no side effects) |
| `/health` | GET | No | Health check (used by invite app for warm-up) |

### Dashboard API

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/auth/challenge` | POST | No | Get a challenge string for Keychain signing |
| `/auth/verify` | POST | No | Verify signed challenge → JWT session token |
| `/api/batches` | POST | JWT | Generate a new batch of gift cards |
| `/api/batches` | GET | JWT | List batches for the authenticated issuer |
| `/api/batches/:id` | GET | JWT | Batch detail with per-card status |
| `/api/batches/:id/pdf` | GET | JWT | Download combined PDF |
| `/api/batches/:id/manifest` | GET | JWT | Download manifest (contains PINs) |

## Authentication

Dashboard API uses Hive Keychain challenge-response:
1. Client requests `POST /auth/challenge` with `{ username }`
2. Client signs the challenge with Keychain (posting key)
3. Client sends `POST /auth/verify` with `{ username, challenge, signature }`
4. Service verifies against on-chain posting key, returns JWT (24h expiry)
5. Subsequent API calls use `Authorization: Bearer <jwt>`

Only issuers in `GIFTCARD_ALLOWED_PROVIDERS` can authenticate.

## Environment Variables

### Required
- `GIFTCARD_PROVIDER_ACCOUNT` — default provider account
- `GIFTCARD_ACTIVE_KEY` — provider's active key (WIF)
- `GIFTCARD_MEMO_KEY` — provider's memo key (WIF)
- `HAA_SERVICE_ACCOUNT` — feed service account
- `GIFTCARD_DELEGATION_VESTS` — HP delegation amount

### Dashboard API
- `GIFTCARD_JWT_SECRET` — JWT signing secret (required for dashboard)

### Multi-Tenant
- `GIFTCARD_SERVICE_ACCOUNT` — shared service account
- `GIFTCARD_SERVICE_ACTIVE_KEY` — service active key
- `GIFTCARD_SERVICE_MEMO_KEY` — service memo key (for card signing)
- `GIFTCARD_ALLOWED_PROVIDERS` — comma-separated issuer allowlist

## Database

SQLite via `better-sqlite3`. Tables:
- `batches` — batch metadata, provider attribution, PDF/manifest blobs
- `tokens` — individual card tokens with status tracking
- `spent_tokens` — Merkle proof validation path (token hashes only)

## Deployment

- Fly.io with persistent volume (for SQLite)
- `min_machines_running: 0` with auto-stop
- Secrets: provider keys, JWT secret, service configuration

## Dev

```bash
npm run dev    # tsx watch
npm start      # production
npm test       # vitest
```

## Related

- `invite/` — the frontend that calls this service
- `dashboard/` — the issuer dashboard (calls dashboard API)
- `scripts/giftcard-generate.ts` — CLI batch generation (independent copy)
- Requirements.md section 2.4 (gift card design) and 2.9 (dashboard)
