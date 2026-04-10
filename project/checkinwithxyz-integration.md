# CheckinWithXYZ Integration — Requirements

## Context

[CheckinWithXYZ](https://github.com/sag333ar/checkinwithxyz) is a Hive onboarding verification app with an existing network of **onboarders** — trusted community members who bring new users to Hive. New users go through a wizard (selfie, introduction, community selection) to publish a verified intro post on-chain, which the onboarder then approves.

The app has an active history of successful onboarding: leaderboards tracking onboards by country, user, and community; a newbie task checklist for retention; a shared feed via `@pioneersupporter` where all new users' posts are aggregated for community support. The onboarder network and this infrastructure are the primary value.

### How account creation worked previously

Account creation used Hive Keychain's QR code method:

1. New user installs Hive Keychain (browser extension or mobile app)
2. Keychain generates keys locally — private keys never leave the device
3. Keychain displays a QR code representing a `create_account` transaction containing the username and 4 public keys
4. The onboarder scans the QR with their own Keychain and signs the transaction, paying ~3 HIVE
5. The account is created on-chain

This required two apps (Keychain + CheckinWithXYZ) and the onboarder paid the account creation cost out of pocket. The goal of this integration is to bring account creation into CheckinWithXYZ itself, funded by gift cards instead of the onboarder's HIVE.

### Why integrate?

Gift cards close two gaps:

1. **Cost** — account creation shifts from the onboarder (3 HIVE per account) to issuer-funded gift card tokens
2. **Workflow** — the onboarder does everything from CheckinWithXYZ instead of switching between two apps

The app will **not be rebranded** — keeping the CheckinWithXYZ name is important for bringing back the existing onboarder community.

### Why Keychain first?

The selfie + intro post in CheckinWithXYZ serves as **proof of humanity and proof of independent account control**. The newbie must log into CheckinWithXYZ with their own Keychain to post the selfie — proving they hold their own keys, not the onboarder. This prevents the known abuse pattern where onboarders "onboard" users but actually retain control of their accounts.

This means Keychain installation must come *before* the selfie, not after. The new user must be fully set up with a working wallet before the onboarder gets credit for the onboarding.

### Relationship to existing roles

| Existing role (section 2.9) | CheckinWithXYZ equivalent | Notes |
|-----|-----|-----|
| Issuer | Not present in CheckinWithXYZ | Issuers generate batches externally and load cards into CheckinWithXYZ for distribution |
| Distributor | Onboarder | CheckinWithXYZ onboarders are distributors — they hand out cards but do not generate them |
| Operator | CheckinWithXYZ admin | Manages the onboarder whitelist; in this integration, also loads cards from issuers |

CheckinWithXYZ becomes a **web-based distribution platform** — an alternative to the Telegram/Discord bot distribution channels described in section 2.9.5. The onboarder's Hive account maps to the distributor role. Authorization can follow the existing `propolis_distributor_authorize` on-chain model (section 2.9.5), with `"platforms": { "checkinwithxyz": true }` as the platform mapping.

### Existing CheckinWithXYZ infrastructure to preserve

The following infrastructure already exists and should be preserved or integrated with:

- **Leaderboards** — onboards tracked by country, user, and community
- **`@pioneersupporter`** — all new users follow this account and join a shared community, creating an aggregated feed at `ecency.com/@pioneersupporter/feed` for community support and retention measurement
- **Newbie task checklist** — post-onboarding tasks that guide new users and drive engagement
- **Approval flow** — onboarders review and approve check-ins, triggering rewards

---

## Integration Design

### Primary flow: Keychain QR scan

The new user installs Keychain first. This is the same proven approach CheckinWithXYZ used before, but with gift card funding replacing the 3 HIVE cost.

**End-to-end flow:**

1. **Onboarder helps newbie install Hive Keychain** (mobile app or browser extension)
2. **Newbie opens Keychain**, which generates keys locally and displays a QR code representing a `create_account` transaction containing the desired username and 4 public keys
3. **Onboarder opens CheckinWithXYZ**, taps "Create Account", and scans the newbie's Keychain QR
4. **CheckinWithXYZ parses the QR**, extracts username and public keys, and calls the gift card service's `/claim` endpoint with a token from the onboarder's card pool
5. **Account is created** on-chain using the issuer-funded gift card token. The `/claim` endpoint supports auto-follow and community subscription, so the new account is automatically set up with `@pioneersupporter` and the appropriate community.
6. **Newbie is immediately ready** — Keychain is installed, keys are in it, account exists on-chain
7. **Newbie opens CheckinWithXYZ**, logs in via Keychain → selfie → intro post → publish (all signed via Keychain)
8. **Onboarder sees the check-in** in their pending approvals → approves → reward sent

**Why this works:** The `/claim` endpoint accepts externally-provided public keys (see `PublicKeys` interface in `giftcard/src/hive/account.ts`). It does not require that keys were generated by the invite app — any valid Hive public keys are accepted.

**Key differences from the old flow:**
- The onboarder no longer pays 3 HIVE — the gift card token covers account creation
- The onboarder scans in CheckinWithXYZ instead of Keychain — one app instead of two
- Auto-follow and community subscription happen automatically at account creation
- The `/claim` request includes `autoFollow` (e.g. `["onboarder-alice", "pioneersupporter"]`), `communities`, and `referrer` — these are added by the service when constructing the request, not from the Keychain QR

### Architecture: Onboarder API service

Token custody and `/claim` calls are handled by a **service the operator controls**, not by CheckinWithXYZ's backend or the browser. This avoids three problems:

1. **No backend changes needed from Sagar** — CheckinWithXYZ's closed-source backend is not modified
2. **Tokens never reach the browser** — a compromised onboarder cannot extract and stockpile tokens
3. **CORS is straightforward** — the service sets `Access-Control-Allow-Origin: https://checkinwith.xyz`

**How it works:**

CheckinWithXYZ's frontend authenticates the onboarder via Hive Keychain signature (same challenge-response pattern as the existing dashboard auth: `POST /auth/challenge` → Keychain signs → `POST /auth/verify` → JWT). Then it calls the onboarder API to consume a token.

The onboarder API is a thin layer on top of the existing gift card service:

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/challenge` | POST | No | Generate challenge string for Keychain signing |
| `/auth/verify` | POST | No | Verify Keychain signature → JWT |
| `/onboarder/cards` | GET | JWT | Get onboarder's available card count and history |
| `/onboarder/create-account` | POST | JWT | Consume a token: accepts username + public keys, adds autoFollow/communities/referrer, calls `/claim` on the gift card service server-side |

The `create-account` endpoint:
1. Verifies the JWT (onboarder is authenticated)
2. Checks the onboarder has available tokens in their pool
3. Picks a token from the pool
4. Constructs the full `/claim` request: username + keys (from the request) + token + cryptographic fields + autoFollow/communities/referrer (from the onboarder's config)
5. Calls the gift card service's `/claim` endpoint server-side
6. On success: marks the token as used, returns the created account name
7. On failure: returns the error, token remains available for retry

**Where this service runs:** It could be a new service on Fly.io, or it could be additional endpoints on the existing gift card service. The latter is simpler — the gift card service already has the token database, auth infrastructure, and `/claim` logic. Adding `/onboarder/*` endpoints to the gift card service avoids a separate deployment.

### Card loading

Issuers generate batches externally using existing tooling (`giftcard-generate.ts` CLI or the dashboard at HiveInvite.com). Each batch is created with the onboarder's username as `referrer` and includes `@pioneersupporter` in `autoFollow` and the appropriate community:

```bash
npx tsx giftcard-generate.ts \
  --count 20 \
  --referrer onboarder-alice \
  --auto-follow onboarder-alice,pioneersupporter \
  --communities hive-123456
```

Tokens are loaded into the onboarder API service (not into CheckinWithXYZ), tagged to the target onboarder. This can be done via:

- **Admin CLI** — load a manifest file and assign to an onboarder
- **Dashboard API** — the existing HiveInvite.com dashboard could gain an "assign to onboarder" feature for batches

The newbie never sees a gift card, QR code, or PIN — the gift card is an internal resource consumed server-side on the onboarder's behalf.

### Onboarder card management

Onboarders see a "My Cards" section in CheckinWithXYZ:

- **Available cards** — count of unused tokens in their pool (fetched from onboarder API)
- **Create Account** button — opens QR scanner to scan a Keychain QR and create an account
- **History** — list of accounts created with their cards (username, date)

Each card consumption:
1. Onboarder taps "Create Account"
2. QR scanner opens
3. Onboarder scans the newbie's Keychain QR
4. CheckinWithXYZ parses the `create_account` transaction, extracts username + public keys
5. Confirmation screen: "Create account @username?" with the onboarder's remaining card count
6. On confirm: calls onboarder API `POST /onboarder/create-account` with username + keys
7. Onboarder API picks a token, calls `/claim` server-side → account created
8. Success: "Account @username created! They can now log into CheckinWithXYZ."

---

## What Changes Where

### Gift card service (`giftcard/`)

- **New: Onboarder API endpoints** — `/auth/*` (reuse existing), `/onboarder/cards`, `/onboarder/create-account`. These are additional routes on the existing service, not a separate deployment.
- **New: Onboarder-to-token assignment** — database table mapping onboarder usernames to their token pools. Tokens are assigned at load time, consumed at account creation.
- **Existing `/claim` endpoint unchanged** — the onboarder API calls it internally.

### CheckinWithXYZ (separate repo, frontend only)

- **New: Onboarder API client** — calls the onboarder API service (Keychain auth + card management + create-account)
- **New: Onboarder "My Cards" page** — card count, "Create Account" button, history
- **New: Keychain QR scanner** — camera-based QR scanner that parses `create_account` transactions, extracts username and public keys
- **No backend changes** — all token custody and `/claim` calls go through the onboarder API service
- **Existing selfie/intro/approval flow unchanged** — the newbie logs into CheckinWithXYZ with Keychain and goes through the existing wizard
- **Existing leaderboards, tracking, checklist, and `@pioneersupporter` integration preserved**

### Invite app (`invite/`)

- No changes for this flow. The invite app is not involved — the newbie never sees a gift card. The invite app remains available for other use cases (remote distribution, non-CheckinWithXYZ onboarding).

### Gift card generation (`scripts/giftcard-generate.ts`)

- No changes required for the primary flow. The existing `--referrer`, `--auto-follow`, and `--communities` flags are sufficient.
- The `checkinwith` card design (in `scripts/designs/checkinwith/`) may be useful for marketing materials but is not needed for the primary flow since the newbie never sees a physical card.

---

## Open Questions

1. **Reward mechanism** — CheckinWithXYZ currently sends HBD rewards from `@threespeakselfie` when an onboarder approves a check-in. Would this integration use the same reward account, a different one, or skip rewards entirely (since the gift card itself is the value provided to the new user)?

2. **Onboarder authorization model** — Should CheckinWithXYZ onboarders be formally authorized as distributors on-chain (via `propolis_distributor_authorize`), or is the CheckinWithXYZ whitelist sufficient? On-chain authorization provides auditability and interoperability with other distribution channels; the whitelist is simpler but siloed.

3. **Keychain QR format** — The exact format of Keychain's `create_account` QR code needs to be verified. It likely contains a serialized Hive transaction with the operation type, username, and public keys. The QR parser in CheckinWithXYZ must handle this format correctly.

4. **Localisation** — CheckinWithXYZ appears to be English-only — is localisation of the distribution UI a concern?

### Resolved

- **CheckinWithXYZ backend access** — resolved: the onboarder API runs as new endpoints on the gift card service. No changes to Sagar's backend needed. CheckinWithXYZ frontend calls the onboarder API directly (CORS allowed).
- **Manifest security / token custody** — resolved: tokens are stored in the onboarder API service (gift card service), never reach the browser. CheckinWithXYZ frontend only sends username + public keys; the service picks the token and calls `/claim` server-side.

---

## Implementation Priorities

**Phase 1 — Onboarder API (this repo, `giftcard/`):**
New endpoints on the gift card service for onboarder authentication, card pool management, and account creation.

- Onboarder-to-token assignment table in SQLite
- `POST /auth/challenge` + `POST /auth/verify` — Keychain auth (reuse existing dashboard auth)
- `GET /onboarder/cards` — card count and history for authenticated onboarder
- `POST /onboarder/create-account` — accepts username + public keys, picks token from pool, calls `/claim` internally
- Admin CLI or API for loading manifests and assigning tokens to onboarders
- CORS for `checkinwith.xyz`

**Phase 2 — CheckinWithXYZ frontend (separate repo):**
The onboarder-facing UI. Frontend-only changes, no backend modifications to Sagar's code.

- Keychain QR scanner — camera-based scanner that parses `create_account` transactions
- Onboarder API client — Keychain auth + card management + create-account calls
- "My Cards" page — card count, "Create Account" button, history
- Integration with existing CheckinWithXYZ navigation and auth

**Phase 3 — Full integration:**
- On-chain distributor authorization for onboarders
- Automated card loading from issuer batches via dashboard
- Cross-platform distributor management (same onboarder authorized across CheckinWithXYZ, Telegram bot, Discord bot)
- Integration with existing leaderboard and tracking systems

---

## Salvageable Work

The `feature/checkinwithxyz-postclaim-flow` branch in this repo contains work from an earlier design iteration that put the selfie/intro flow in the invite app. This was abandoned because the selfie must be gated behind a Keychain login to prove independent account control. However, the following pieces may be reusable:

- **`invite/src/hive/broadcast.ts`** — general-purpose Hive post broadcasting module using `hive-tx` Transaction class. Could be useful for other invite app features.
- **`invite/src/hive/image-upload.ts`** — image resize (canvas) + upload to `images.hive.blog` with posting key signature. Reusable for any Hive app that needs image hosting.
- **`scripts/designs/checkinwith/design.ts`** — CheckinWithXYZ-branded card design (blue theme from checkinwith.xyz). Useful for marketing materials or if remote gift card distribution is added later.
- **`postClaimFlow` and `onboarder` payload fields** — still potentially useful if a secondary remote/async onboarding path is added in the future where the invite app directs users to CheckinWithXYZ after account creation.
