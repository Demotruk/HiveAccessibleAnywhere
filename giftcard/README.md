# Hive Invite Service

Creates Hive accounts from single-use claim tokens distributed via QR-code gift cards. Includes a dashboard API for issuer batch management.

## Quick Start (Docker)

```bash
docker run -d \
  --name hive-invite-service \
  -p 3200:3200 \
  -v hive-invite-data:/data \
  -e GIFTCARD_PROVIDER_ACCOUNT=your-hive-account \
  -e GIFTCARD_ACTIVE_KEY=5K... \
  -e GIFTCARD_MEMO_KEY=5K... \
  -e HAA_SERVICE_ACCOUNT=haa-service \
  -e GIFTCARD_DELEGATION_VESTS="30000.000000 VESTS" \
  ghcr.io/demotruk/hive-invite-service:latest
```

The service will be available at `http://localhost:3200`.

## Data Persistence

SQLite database is stored in `/data` inside the container. Mount a volume to persist it across restarts:

```bash
-v hive-invite-data:/data
```

## Configuration

See [.env.example](.env.example) for all available environment variables.

### Required (Single-Tenant)

| Variable | Description |
|----------|-------------|
| `GIFTCARD_PROVIDER_ACCOUNT` | Hive account that owns claimed account tokens |
| `GIFTCARD_ACTIVE_KEY` | Provider's active key (WIF) |
| `GIFTCARD_MEMO_KEY` | Provider's memo key (WIF) |
| `HAA_SERVICE_ACCOUNT` | Feed/discovery service account name |
| `GIFTCARD_DELEGATION_VESTS` | HP delegation for new accounts (e.g. `30000.000000 VESTS`) |

### Multi-Tenant Mode

Set both `GIFTCARD_SERVICE_ACCOUNT` and `GIFTCARD_SERVICE_ACTIVE_KEY` to enable multi-tenant mode, where multiple issuers delegate active authority to a shared service account.

| Variable | Description |
|----------|-------------|
| `GIFTCARD_SERVICE_ACCOUNT` | Shared service account name |
| `GIFTCARD_SERVICE_ACTIVE_KEY` | Service account's active key (WIF) |
| `GIFTCARD_ALLOWED_PROVIDERS` | Comma-separated issuer allowlist |

### Dashboard API

| Variable | Description |
|----------|-------------|
| `GIFTCARD_JWT_SECRET` | JWT signing secret (required for dashboard endpoints) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3200` | Server port |
| `GIFTCARD_DB_PATH` | `/data/tokens.db` | SQLite database path |
| `HIVE_NODES` | Public nodes | Comma-separated Hive API nodes |
| `COVER_SITE_THEME` | `tech` | Cover page theme |
| `GIFTCARD_INVITE_BASE_URL` | `https://hiveinvite.com` | Base URL for invite/restore apps |

## Building Locally

```bash
docker build -t hive-invite-service ./giftcard
docker run --rm -p 3200:3200 --env-file giftcard/.env -v hive-invite-data:/data hive-invite-service
```

## Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Cover site |
| `/claim` | POST | Redeem a claim token to create a Hive account |
| `/validate` | POST | Pre-flight token validation |
| `/health` | GET | Health check |
| `/auth/challenge` | POST | Get a Keychain challenge |
| `/auth/verify` | POST | Verify signed challenge, get JWT |
| `/api/batches` | GET/POST | List or create gift card batches (JWT required) |
