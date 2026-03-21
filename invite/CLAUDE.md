# Invite App

A Vite-built single-page onboarding app that guides new users from gift card QR scan to a working Hive account. Bundled as a single HTML file, hosted on GitHub Pages.

## Flow

Sequential screens (no hash routing):
1. **Landing** — detect encrypted fragment in URL
2. **PIN entry** — 6-character alphanumeric PIN decrypts the QR payload
3. **Verifying** — validate token signature against provider's on-chain memo key
4. **Username** — user picks a Hive username (availability checked on-chain)
5. **Key backup** — display master password + QR backup; user must save before proceeding
6. **Claiming** — POST to gift card service `/claim` endpoint
7. **Success** — handoff to wallet experience

## Two Variants

The flow adapts based on the `variant` field in the decrypted payload:

**Standard invites** (unrestricted internet):
- Uses public Hive API nodes directly
- After account creation, redirects to peakd.com via HiveSigner OAuth
- No proxy infrastructure needed

**Robust invites** (restricted internet):
- Uses proxy endpoints from the encrypted payload for all RPC calls
- After account creation, fetches Propolis wallet from blockchain and transitions into it via `document.open()/write()/close()`
- Writes credentials + proxy endpoints to `localStorage` for wallet pre-authenticated startup
- Generates personalized bootstrap file for future wallet access

## QR Payload Structure

```
https://<invite-app-url>/invite#<encrypted-blob>
```

Fragment (never sent to server) contains PIN-encrypted data:
- `token` — single-use claim token
- `provider` — issuer's Hive account
- `serviceUrl` — gift card service URL
- `variant` — "standard" or "robust"
- `endpoints` — *(robust only)* onboarding proxy URLs
- `locale` — *(robust only)* wallet locale to fetch
- `batchId`, `expires`, `signature`, `promiseType`, `promiseParams`

## Key Constraints

- **Bundle as single HTML** — `vite-plugin-singlefile`
- **PIN is 6 alphanumeric chars** (~31 bits entropy) — AES-256-GCM with Argon2id KDF
- **Keys generated locally** — only public keys sent to gift card service
- **URL fragment cleared immediately** after decryption
- **Authenticity verified** — provider's memo key signature checked on-chain before proceeding
- **Gift card service warm-up** — `/health` ping fires at PIN entry screen to mask Fly.io cold start

## UX Notes (from user testing)

- Key backup step must be prominently enforced — users skip it
- Account creation can take 10-30s (cold start + on-chain TX) — show progress + time estimate
- HiveSigner handoff has friction — upstream improvements pending (@asgarth PeakLock deep link, @good-karma HiveSigner username param)
- Each screen is a drop-off point — minimize user actions

## Build

```bash
npm run build    # single HTML output
npm run dev      # dev server
```

## Related

- `giftcard/` — the backend service this app calls
- `restore/` — companion app for recovering keys from backup QR
- `scripts/giftcard-generate.ts` — generates the card batches with encrypted QR payloads
- Requirements.md section 2.4 for complete gift card onboarding design
