# HiveAccessibleAnywhere / Propolis

Make HBD savings (~20% APR, USD-pegged stablecoin) accessible to anyone, including regions where Hive infrastructure is blocked.

## Project Structure

This is a monorepo with several independent applications:

| Directory | What it is | Status |
|-----------|-----------|--------|
| `wallet/` | Propolis Wallet — self-contained HTML wallet, distributed on-chain | Phase 1 shipped, all 7 locales published |
| `proxy/` | RPC proxy that relays obfuscated requests to Hive API nodes | Phase 2, deployed on Fly.io |
| `giftcard/` | Gift card claim service — creates Hive accounts from single-use tokens | Phase 2, deployed on Fly.io |
| `invite/` | Invite app — browser-based onboarding flow (PIN → username → keys → claim) | Phase 2, hosted on GitHub Pages |
| `restore/` | Backup restore app — recover keys from encrypted QR backup | Phase 2, hosted on GitHub Pages |
| `telegram-bot/` | Telegram bot for gift card distribution in group chats | Phase 2, deployed on Fly.io |
| `scripts/` | Publishing, deployment, and card generation scripts | Tooling |
| `hive-branding/` | Brand assets | Static |
| `docs/` | GitHub Pages site (bootstrap files, QR codes, landing page) | Deployed |

## Branding

- **Propolis** = the wallet only. All infrastructure (proxy, scripts, service accounts) uses "Hive Accessible Anywhere" / `haa-*` naming.
- Wallet localStorage keys: Phase 1 uses `haa_*` (kept for migration), Phase 2 uses `propolis_*`.

## Hive Accounts

| Account | Purpose |
|---------|---------|
| `propolis-publish` | Production wallet publishing (on-chain) |
| `propolis-dev` | Dev wallet publishing |
| `haa-service` | Endpoint discovery service (sends encrypted proxy URLs via memo) |

## Key Constraints

- **170KB wallet size limit** — the built single-file HTML must stay under 170KB for on-chain distribution
- **55KB chunk limit** — on-chain comments are split at 55KB each
- **5-minute delay between root posts** — Hive enforces this per account; scripts handle it for `--all-locales`
- **7 locales**: en, zh, ar, fa, ru, tr, vi
- `bridge.get_discussion` does NOT accept a `limit` parameter (causes "Invalid parameters")
- ~27B Resource Credits needed for a 55KB comment; delegate HP if insufficient

## Build Commands

```bash
# Wallet
cd wallet && npm run build          # Phase 1 (default)
cd wallet && npm run build:phase2   # Phase 2
cd wallet && npm run build:all      # All 7 locales

# Invite app
cd invite && npm run build

# Restore app
cd restore && npm run build

# From root
npm run build                       # wallet + invite
npm run deploy:pages               # copy bootstrap to docs/ + QR codes
```

## Environment Variables

- Production: `PROPOLIS_ACCOUNT`, `PROPOLIS_POSTING_KEY`
- Dev: `PROPOLIS_DEV_ACCOUNT`, `PROPOLIS_DEV_POSTING_KEY`
- Infrastructure scripts: `HAA_*` env vars
- `.env` file lives in `scripts/`

## Phase Architecture

- **Phase 1** (shipped): Wallet connects directly to public Hive API nodes. No proxy, no obfuscation.
- **Phase 2** (active): Adds proxy network, traffic obfuscation, encrypted endpoint discovery, gift card onboarding.
- **Phase 3** (future): On/off ramp integration (fiat ↔ HBD). Not in scope yet.

`isPhase2()` in `wallet/src/phase.ts` gates all Phase 2 UI and logic. Vite dead-code-eliminates gated code in Phase 1 builds.

## On-Chain Distribution

The wallet is distributed as Hive blockchain posts:
1. Root post contains `json_metadata.propolis` with SHA-256 hash manifest
2. Wallet code split into ~4 comments at 55KB each, with code-fenced bodies
3. Bootstrap HTML (~47KB) fetches chunks via `bridge.get_discussion`, verifies hashes, assembles and executes
4. Each locale = 1 root post + chunk comments + 1 bootstrap post

Security: Only comments from the publisher account are processed. All chunks verified before any code executes. No partial execution.

## Git Workflow

- `develop` branch for active work
- `main` branch for production
- **Never merge to main without asking permission first**
- Tagging and production publishing also require explicit approval
- Dev builds → `propolis-dev` account; production → `propolis-publish`

## Full Requirements

See `Requirements.md` for the complete product specification, including detailed design rationale, open questions, and future considerations. The CLAUDE.md files in each subdirectory contain the operational subset relevant to that component.
