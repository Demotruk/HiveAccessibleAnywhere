# Dashboard

Issuer dashboard for managing gift card batches. Built with Preact + HTM (tagged template literals, no JSX build step). Deployed to HiveInvite.com at `/dashboard/`.

## Architecture

- **Preact + HTM** — lightweight UI with tagged template components
- **Hash routing** — `#login`, `#batches`, `#batches/generate`, `#batches/:id`
- **JWT auth** — Hive Keychain challenge-response, token persisted in sessionStorage
- **API calls** — fetch wrapper with JWT injection, dev proxy to localhost:3200

```
src/
  main.ts              # Entry point
  types.ts             # API types + Keychain type declarations
  state.ts             # Simple reactive state (pub/sub)
  api.ts               # Fetch wrapper with JWT injection
  auth.ts              # Hive Keychain integration
  styles.css           # Dark theme CSS
  components/
    app.ts             # Root component + hash router
    header.ts          # Nav bar (username, logout)
    login.ts           # Keychain sign-in
    batch-list.ts      # Batch listing with status badges
    batch-form.ts      # Generate batch form
    batch-detail.ts    # Per-card detail view + downloads
```

## Screens

| Screen | Route | Purpose |
|--------|-------|---------|
| Login | `#login` | Keychain auth |
| Batch List | `#batches` | All batches with status, download links |
| Generate | `#batches/generate` | Create new batch (count, locale, variant, expiry) |
| Batch Detail | `#batches/:id` | Per-card status, downloads |

## API Dependency

Requires the giftcard service API (see `giftcard/CLAUDE.md`):
- `POST /auth/challenge` + `POST /auth/verify` — Keychain login
- `POST /api/batches` — Generate batch
- `GET /api/batches` — List batches
- `GET /api/batches/:id` — Batch detail
- `GET /api/batches/:id/pdf` — Download PDF
- `GET /api/batches/:id/manifest` — Download manifest

## Dev

```bash
npm run dev    # Vite dev server (port 5179), proxies /auth and /api to localhost:3200
npm run build  # Production build
npm test       # Vitest
```

Requires the giftcard service running locally:
```bash
cd ../giftcard && npm run dev   # port 3200
```

## Production Build

Set `API_BASE` to the giftcard service URL:
```bash
API_BASE=https://giftcard-service.fly.dev npm run build
```

## Key Constraints

- JWT persisted in sessionStorage — survives page refresh, cleared on tab close or logout
- Only `hive` design supported in v1 (server rejects others)
- Issuers must be pre-whitelisted via `GIFTCARD_ALLOWED_PROVIDERS`
- File downloads use blob fetch with auth header (cannot use plain links)

## Related

- `giftcard/` — backend API
- `invite/` — end-user claim flow
- `scripts/deploy-hiveinvite.ts` — assembles HiveInvite.com static site
- project/requirements.md section 2.9 for full dashboard specification
