# Telegram Gift Card Bot

A Telegram bot (Grammy framework) that distributes Propolis gift cards in group chats. Operators supply gift cards; group members receive them free (operator/trusted users) or purchase with HBD/Bitcoin.

## Architecture

```
src/
  index.ts                    # Entry: init config, DB, bot, transfer monitor
  bot.ts                      # Grammy bot setup, command registration
  config.ts                   # Configuration (env vars, operator ID)
  db.ts                       # SQLite schema (cards, prices, trusted users, transactions)
  send-card.ts                # Card delivery logic (PDF → images → Telegram DM)
  deep-link.ts                # Handle gc_CODE deep links
  hive/
    transfer-monitor.ts       # Monitor HBD transfers for payment confirmation
  commands/
    gift.ts                   # /gift @user (operator only, free)
    buygift.ts                # /buygift [@user] (paid, triggers payment flow)
    load.ts                   # /load <batch-id> (load cards from batch dir)
    stock.ts                  # /stock (check inventory)
    setprice.ts               # /setprice <amount> (set HBD price)
    clear.ts                  # /clear <batch-id> (remove batch cards)
    trust.ts                  # /trust @user (grant free gifting)
    untrust.ts                # /untrust @user (revoke)
    trusted.ts                # /trusted (list trusted users)
    share.ts                  # /share [count] (generate shareable codes)
```

## Commands

**Operator only** (7): `/load`, `/stock`, `/setprice`, `/clear`, `/trust`, `/untrust`, `/trusted`, `/share`
**Operator + trusted**: `/gift @user` (free)
**All users**: `/buygift [@user]` (paid), deep link claim

## Payment Flow

Two methods for non-operator purchases:

1. **HBD** — transfer to operator's Hive account with memo matching pending transaction. `transfer-monitor.ts` watches for confirmation.
2. **Bitcoin via v4v.app** — generates payment link that converts BTC → HBD. Bot monitors for resulting HBD transfer.

## Card Delivery

Gift cards are loaded as PDFs (same format produced by `scripts/giftcard-generate.ts`). The bot converts PDF pages to PNG images via `mupdf` and sends them via Telegram DM.

## Database

SQLite via `better-sqlite3`:
- Card inventory (batch, status, assignee)
- Pricing configuration
- Trusted user list
- Transaction log (payments, deliveries)

## Deployment

- Fly.io with persistent volume (SQLite + loaded card PDFs)
- Deploy via `scripts/deploy-telegram-bot.ts`
- Requires: `TELEGRAM_BOT_TOKEN`, `OPERATOR_TELEGRAM_ID`, Hive account credentials

## Dev

```bash
npm run dev      # tsx watch
npm start        # production
```

## Related

- `scripts/giftcard-generate.ts` — produces the PDF card batches loaded via `/load`
- `giftcard/` — the separate claim service (this bot distributes cards, that service redeems them)
- Requirements.md "Telegram Gift Card Bot" and "Discord Gift Card Bot" in Future Considerations
