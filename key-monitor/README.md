# Hive Key Monitor

Watches Hive accounts for unexpected operations by a delegated service account. Alerts via Telegram when anything other than expected operations (`create_claimed_account`, `delegate_vesting_shares`) is detected.

## Quick Start (Docker)

```bash
docker run -d \
  --name hive-key-monitor \
  -v hive-key-monitor-data:/data \
  -e WATCH_ACCOUNTS=account1,account2 \
  -e TELEGRAM_BOT_TOKEN=123456:ABC-DEF... \
  -e TELEGRAM_CHAT_ID=123456789 \
  ghcr.io/demotruk/hive-key-monitor:latest
```

## How It Works

1. On startup, initializes a high-water mark per account from the chain (historical ops don't trigger alerts)
2. Polls `condenser_api.get_account_history` every 15 seconds (configurable)
3. Checks each new operation against the allowlist
4. Unexpected operations trigger a Telegram alert with a link to review/revoke authorities on Peakd
5. State is persisted to `/data/state.json` so restarts don't re-alert

## Data Persistence

State file tracks the last-seen operation index per account. Mount a volume to persist across restarts:

```bash
-v hive-key-monitor-data:/data
```

## Configuration

See [.env.example](.env.example) for all available environment variables.

### Required

| Variable | Description |
|----------|-------------|
| `WATCH_ACCOUNTS` | Comma-separated Hive accounts to watch |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | Telegram chat ID to send alerts to |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `HIVE_NODES` | Public nodes | Comma-separated Hive API nodes |
| `POLL_INTERVAL_MS` | `15000` | Polling interval in milliseconds |
| `STATE_FILE` | `/data/state.json` | Path to state persistence file |

## Building Locally

```bash
docker build -t hive-key-monitor ./key-monitor
docker run --rm --env-file key-monitor/.env -v hive-key-monitor-data:/data hive-key-monitor
```
