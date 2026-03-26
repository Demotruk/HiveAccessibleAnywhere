# Gift Card Bot (Telegram + Discord)

Distributes Propolis gift cards via Telegram (Grammy) and Discord (discord.js), running in a single process. Operators supply gift cards; users receive them free (operator/trusted) or purchase with HBD/Bitcoin.

## Architecture

```
src/
  index.ts                    # Entry: init config, DB, both bots, transfer monitor
  bot.ts                      # Grammy (Telegram) bot setup, command registration
  discord-bot.ts              # discord.js bot setup, slash commands, button routing
  config.ts                   # Configuration (env vars, operator IDs)
  db.ts                       # SQLite schema (cards, payments, trusted users, shared links)
  notifier.ts                 # PaymentNotifier interface + platform implementations
  send-card.ts                # Telegram card delivery (PDF → images → Grammy DM)
  send-card-discord.ts        # Discord card delivery (PDF → images → discord.js DM)
  pdf-to-images.ts            # Platform-agnostic PDF → PNG conversion (mupdf)
  deep-link.ts                # Telegram gc_CODE deep link handler
  inventory.ts                # Load cards from manifest.json
  v4v.ts                      # Lightning invoice generation via v4v.app
  hive/
    transfer-monitor.ts       # Monitor HBD transfers, dispatch to platform notifiers
  commands/                   # Telegram command handlers
    gift.ts buygift.ts load.ts stock.ts setprice.ts
    clear.ts trust.ts share.ts
  discord-commands/            # Discord command handlers
    gift.ts buygift.ts load.ts stock.ts setprice.ts
    clear.ts trust.ts share.ts claim.ts
```

## Commands

Both platforms support the same commands. Telegram uses text commands, Discord uses slash commands with buttons.

**Operator only**: `/load`, `/stock`, `/setprice`, `/clear`, `/trust`, `/untrust`, `/trusted`, `/share`
**Operator + trusted**: `/gift @user` (free)
**All users**: `/buygift [@user]` (paid), `/claim <code>`

## Payment Flow

Two methods for non-operator purchases:

1. **HBD** — transfer to operator's Hive account with memo matching pending transaction. `transfer-monitor.ts` watches for confirmation and dispatches to the correct platform notifier.
2. **Bitcoin via v4v.app** — generates Lightning invoice that converts BTC → HBD. The resulting HBD transfer is detected by the same monitor.

Discord uses button interactions for payment method selection; Telegram uses text-based instructions.

## Card Delivery

Gift cards are loaded as PDFs (produced by `scripts/giftcard-generate.ts`). The bot converts PDF pages to PNG images via `mupdf` and sends them via DM (Telegram or Discord). Discord has a claim code fallback when DMs are disabled.

## Database

SQLite via `better-sqlite3`:
- Card inventory (batch, status, assignee)
- Payments with `platform` column (`telegram` or `discord`)
- Trusted users with `platform` column
- Shared links (platform-agnostic claim codes)
- Pricing configuration

**Legacy column names:** `telegram_user_id` and `telegram_chat_id` in payments/trusted_users hold the platform-specific user/channel ID regardless of platform. The `platform` column disambiguates.

## Environment Variables

**Required (Telegram):**
- `TELEGRAM_BOT_TOKEN` — Telegram Bot API token
- `OPERATOR_TELEGRAM_ID` — operator's numeric Telegram user ID
- `HIVE_ACCOUNT` — Hive account receiving payments

**Optional (Discord):**
- `DISCORD_BOT_TOKEN` — Discord bot token (Discord bot only starts if set)
- `DISCORD_APPLICATION_ID` — Discord application ID (required if token is set)
- `OPERATOR_DISCORD_ID` — operator's Discord user ID (required if token is set)

**Other:**
- `HIVE_NODES` — comma-separated Hive API nodes
- `GIFTCARD_OUTPUT_DIR` — path to card batch directories
- `GIFT_PRICE_HBD` — default price
- `PAYMENT_TIMEOUT_MINUTES` — payment expiry
- `DB_PATH` — SQLite database path

## Deployment

- Fly.io with persistent volume (SQLite + loaded card PDFs)
- Deploy via `scripts/deploy-telegram-bot.ts`
- Discord secrets: `fly secrets set DISCORD_BOT_TOKEN=...`

## Dev

```bash
npm run dev      # tsx watch
npm start        # production
```

## Related

- `scripts/giftcard-generate.ts` — produces the PDF card batches loaded via `/load`
- `giftcard/` — the separate claim service (this bot distributes cards, that service redeems them)
- Requirements.md "Telegram Gift Card Bot" and "Discord Gift Card Bot" sections
