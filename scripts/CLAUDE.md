# Scripts

Infrastructure, publishing, deployment, and card generation scripts. All TypeScript, run via `tsx`.

## Key Scripts

### On-Chain Publishing

| Script | Purpose |
|--------|---------|
| `distribute-onchain.ts` | Publish wallet to Hive blockchain (root post + chunk comments). Supports `--all-locales` with 5-min delays between root posts |
| `publish-bootstrap.ts` | Publish bootstrap HTML as readable Hive posts. Supports `--all-locales` |
| `deploy-pages.ts` | Copy bootstrap to `docs/` + generate QR codes for GitHub Pages |

### Gift Card Generation

| Script | Purpose |
|--------|---------|
| `giftcard-generate.ts` | Generate card batches — creates tokens, signs with provider memo key, declares batch on-chain (Merkle root), produces PDF cards with QR + PIN |
| `giftcard-manage.ts` | Admin tools for managing card batches |
| `generate-qr.ts` | Generate standalone QR code images |
| `generate-invite-pdf.ts` | Generate invite card PDFs |

### Deployment & Workspace Setup

| Script | Purpose |
|--------|---------|
| `setup-haa-local.ts` | Set up local testing workspace (giftcard + dashboard + invite + restore) at `../haa-local/` |
| `setup-haa-live.ts` | Set up live deployment workspace (giftcard + dashboard + deploy scripts) at `../haa-live/` |
| `deploy-giftcard.ts` | Deploy giftcard service to Fly.io (used from haa-live workspace) |
| `deploy-hiveinvite.ts` | Assemble HiveInvite.com static site (landing + invite + restore + dashboard) |
| `deploy-proxy.ts` | Deploy proxy to Fly.io |
| `deploy-telegram-bot.ts` | Deploy Telegram bot to Fly.io (volumes, secrets) |

### Testing

| Script | Purpose |
|--------|---------|
| `integration-test.ts` | End-to-end integration tests |
| `test-bootstrap-decrypt.ts` | Verify bootstrap file decryption |

## Environment

Scripts read from `scripts/.env`:
- `HAA_*` env vars for infrastructure operations
- `PROPOLIS_ACCOUNT` / `PROPOLIS_POSTING_KEY` for production publishing
- `PROPOLIS_DEV_ACCOUNT` / `PROPOLIS_DEV_POSTING_KEY` for dev publishing

## Common Flags

Most scripts support:
- `--dry-run` — simulate without broadcasting
- `--all-locales` — operate on all 7 locales (en, zh, ar, fa, ru, tr, vi)

## Key Constraints

- **5-minute delay between root posts** — Hive enforces this per account. `--all-locales` scripts handle the delay automatically.
- **55KB chunk size** — wallet is split at this boundary for on-chain comments
- **Merkle root** — batch declarations include SHA-256 Merkle root of all token hashes
- **Provider memo key signing** — each card's data is signed for authenticity verification

## Test Accounts

- `demotruktest27` / `testingnewuser` — used in integration tests
