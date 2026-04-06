---
name: deploy-services
description: Deploy giftcard service and dashboard to Fly.io / HiveInvite.com
user-invocable: true
---

# Deploy Services

Deploy the giftcard service and dashboard to production. This updates the live deployment workspace and guides the user through the manual deploy steps.

## Steps

### 1. Build

Run from the repo root:

```bash
npm run build              # wallet + invite + dashboard
```

### 2. Set up live workspace

```bash
npx tsx scripts/setup-haa-live.ts
```

Do NOT access `../haa-live/` — just run the setup script.

### 3. Deploy giftcard service (MANUAL)

Ask the user to run from their `haa-live` directory:

```
.\deploy.ps1
```

Wait for confirmation. Ask them to verify the health check at `https://<app>.fly.dev/health`.

### 4. Deploy dashboard (MANUAL)

Ask the user to run from their `haa-live` directory:

```
.\deploy-dashboard.ps1
```

Wait for confirmation.

### 5. Smoke test

Remind the user to generate a 1-card test batch from the dashboard and claim it to verify the full flow works end-to-end.
