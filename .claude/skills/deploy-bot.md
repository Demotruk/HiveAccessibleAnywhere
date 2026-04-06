---
name: deploy-bot
description: Deploy the Telegram/Discord invite bot to Fly.io
user-invocable: true
---

# Deploy Bot

Deploy the Telegram/Discord invite bot to Fly.io.

## Steps

### 1. Set up live workspace

Run from the repo root:

```bash
npx tsx scripts/setup-haa-live.ts
```

Do NOT access `../haa-live/` — just run the setup script.

### 2. Deploy (MANUAL)

The bot deployment requires secrets (bot tokens, operator ID). Ask the user to deploy from their `haa-live` directory.

For the standard production bot:

```
cd telegram-bot
fly deploy
```

Or if using the deploy script:

```
.\deploy-bot.ps1
```

Wait for confirmation that the deploy succeeded.

### 3. Verify

The bot should come back online automatically (it runs with `min_machines_running = 1`). Ask the user to send a test command to the bot on Telegram or Discord to verify it's responding.
