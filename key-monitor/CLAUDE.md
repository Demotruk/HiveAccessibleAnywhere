# Key Monitor

Standalone security tool that watches Hive accounts for unexpected operations by a delegated service account. Alerts via Telegram when anything other than the expected operations (`create_claimed_account`, `delegate_vesting_shares`) is detected.

## Architecture

```
src/
  index.ts      # Entry point: load config, init state, start polling loop
  config.ts     # Typed config + env var validation + allowed operations set
  monitor.ts    # Core polling: fetch account history, detect unexpected ops
  alert.ts      # Telegram alerting via Bot API (raw fetch)
  state.ts      # Persist/load last-seen operation index per account (JSON file)
```

## How It Works

1. On startup, initializes a high-water mark per account from the chain (so historical ops don't trigger alerts)
2. Polls `condenser_api.get_account_history` every 15 seconds (configurable)
3. For each new operation, checks against the allowlist
4. Unexpected operations trigger a Telegram alert with a link to review/revoke authorities on Peakd
5. State is persisted to a JSON file so restarts don't re-alert

## Environment Variables

**Required:**
- `WATCH_ACCOUNTS` — comma-separated Hive accounts to watch
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for alerts
- `TELEGRAM_CHAT_ID` — Telegram chat ID to send alerts to

**Optional:**
- `HIVE_NODES` — comma-separated Hive API nodes (default: api.hive.blog, api.deathwing.me, hive-api.arcange.eu)
- `POLL_INTERVAL_MS` — polling interval in ms (default: 15000)
- `STATE_FILE` — path to state file (default: ./data/state.json)

## Dev

```bash
cp .env.example .env  # fill in values
npm install
npm run dev           # tsx watch
npm start             # production
```

## Deployment

Fly.io with persistent volume for state file:

```bash
fly apps create haa-key-monitor
fly volumes create key_monitor_data --region lhr --size 1
fly secrets set WATCH_ACCOUNTS=account1,account2
fly secrets set TELEGRAM_BOT_TOKEN=...
fly secrets set TELEGRAM_CHAT_ID=...
fly deploy
```
