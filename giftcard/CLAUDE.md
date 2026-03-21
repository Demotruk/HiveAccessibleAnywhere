# Gift Card Service

An Express server that redeems single-use claim tokens to create Hive accounts. Deployed separately from the proxy for security isolation — this service holds account creation keys.

## Architecture

```
src/
  server.ts           # Express app, routes, startup
  claim.ts            # Token validation + account creation logic
  batch-cache.ts      # In-memory batch cache (pre-warmed from on-chain history)
  cover-site.ts       # Cover page (blog theme, same pattern as proxy)
  db.ts               # SQLite schema + queries (audit log)
  middleware/
    rate-limit.ts     # Aggressive rate limiting on /claim
```

## Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Cover site (blog theme) |
| `/claim` | POST | Redeem a claim token → create Hive account |
| `/validate` | POST | Pre-flight token validation (no side effects) |
| `/health` | GET | Health check (used by invite app for warm-up) |

## Claim Flow

1. Invite app sends POST `/claim` with `{ token, username, publicKeys }`
2. Service validates token (not expired, not spent, signature valid)
3. Service broadcasts `create_claimed_account` on-chain with user's public keys
4. Service delegates initial HP to new account (for Resource Credits)
5. Service marks token as spent in SQLite
6. *(Robust invites only)* Service sends enrollment transfer to `haa-service`

## Key Constraints

- **Cold start latency** — Fly.io auto-stop means 10-30s cold starts. The invite app pings `/health` early in the flow to warm up the service.
- **Single-use tokens** — each token can only be redeemed once. Idempotent retries (same token + username) should return success.
- **Security isolation** — this service holds the provider's active key (or delegated authority). The proxy does NOT hold account creation keys.
- **Rate limiting** — aggressive throttling on `/claim` to prevent abuse.

## Multi-Provider Support

Multiple Hive accounts can use the same service instance. Providers delegate their active key authority to the service's `invite-authority` key. The service uses the provider's own account creation tokens.

## Database

SQLite via `better-sqlite3`. Stores:
- Claim audit log (token hash, username, status, timestamp)
- Batch metadata

## Deployment

- Fly.io with persistent volume (for SQLite)
- `min_machines_running: 0` with auto-stop
- Secrets: provider active key, service configuration

## Dev

```bash
npm run dev    # tsx watch
npm start      # production
```

## Related

- `invite/` — the frontend that calls this service
- `scripts/giftcard-generate.ts` — generates card batches + tokens
- `scripts/giftcard-manage.ts` — admin tools for batches
- Requirements.md section 2.4 for full gift card design
