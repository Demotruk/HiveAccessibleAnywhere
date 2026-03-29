# HBD Savings Access — Requirements

## Vision

Make HBD savings (currently ~20% APR on a USD-pegged stablecoin) accessible to anyone, anywhere — including regions where Hive infrastructure is partially or fully blocked.

The primary value proposition is simple: high-yield dollar savings with no KYC, no intermediary, and no dependency on traditional banking.

## Context

### Why HBD Savings?

- HBD (Hive Backed Dollars) is a stablecoin pegged to ~$1 USD, native to the Hive blockchain
- HBD placed in Savings earns ~20% APR, set by witness consensus (not hardcoded)
- No KYC or bank relationship required — only a Hive account
- This dramatically outperforms savings instruments in most countries, and is especially compelling in regions with low domestic interest rates, currency devaluation, or capital controls

### The Access Problem

Hive block explorers and some front-end sites are accessible in many restricted regions (e.g. China), but the RPC nodes required for write operations (staking, transfers, account actions) are blocked. This means users can *see* the blockchain but cannot *interact* with it without a VPN.

Additionally:
- Installing browser extensions (e.g. Hive Keychain) may require access to blocked app stores or extension marketplaces
- Creating a Hive account typically requires access to services that may be blocked
- Converting local currency to/from HBD requires access to exchanges that may be blocked

## Project Scope & Delivery Phases

The project delivers value incrementally across three phases. Each phase builds on the previous one, but Phase 1 is independently useful to the entire Hive community — not just users in restricted regions.

### Phase 1 — Propolis Wallet (Initial Release)

**Propolis Wallet** — a self-contained, on-chain-distributed Hive wallet that any Hive user can run in a browser with no installation. Named after the resin bees use to build and protect the hive, Propolis builds itself from on-chain data and connects directly to public Hive API nodes. Useful to the entire Hive community as a lightweight, portable wallet and as a demonstration of on-chain software distribution.

### Phase 2 — Restricted Access Infrastructure

The proxy network, traffic obfuscation, per-user endpoint discovery, onboarding service, and gift card system that enables Hive interaction from regions where RPC nodes are blocked. Builds on the Phase 1 wallet by adding proxy support, encrypted endpoint feeds, and censorship-resistant access.

### Phase 3 — On/Off Ramp Integration (Future)

Enable users to convert local currency to HBD and withdraw HBD back to local currency. Not in scope for initial delivery but the architecture should not preclude it.

---

## Phase 1 Requirements — Propolis Wallet

### Delivery priority

Phase 1 is split into two sub-phases. Phase 1a is the minimum viable release — ship this first. Phase 1b follows shortly after.

**Phase 1a — Minimum viable release:** ✅ **All items shipped and published on-chain. All 7 locales fully live.**
- Self-bootstrapping from a Hive post (sections 1.2, 1.2.1)
- Bootstrap security: author filtering, hash manifest verification (section 1.2.1)
- Local caching after first bootstrap (section 1.2.1)
- Key import for existing accounts (section 1.1)
- View balances, send transfers, manage HBD savings (section 1.1)
- Transaction signing — all signing local, keys never leave the device (section 1.1)
- Publishing tooling — build script to split the wallet and post it on-chain (section 1.3)

**Phase 1b — Fast follows:**
- QR key backup with optional PIN protection (section 1.1)
- QR key import / scan (section 1.1)
- Key generation for new accounts (section 1.1)
- Auto-update version checking (section 1.2.1)
- Standalone save option (section 1.2.1)

### 1.1 Self-Contained Wallet Tool

A standalone HTML file that functions as a minimal Hive wallet, capable of:

- **Key management**: Import and use Hive private keys (active key for transfers/savings, posting key for social operations). Key generation for new accounts is a Phase 1b feature.
- **HBD Savings operations**: Stake HBD to savings, unstake from savings, check balances and interest
- **Transfers**: Send and receive HIVE and HBD
- **Transaction signing**: Sign transactions locally in the browser — private keys never leave the device
- **Key backup** *(Phase 1b)*: Export keys as a QR code for safe offline backup and import on other devices. The backup screen displays the QR code with a prominent warning that anyone with the QR controls the account. An optional "Add PIN protection" toggle encrypts the key data with a user-chosen PIN before encoding the QR. On import, the wallet detects whether the QR is PIN-encrypted and prompts accordingly. The PIN cannot be recovered — the wallet warns the user clearly before enabling this option.

The tool must:
- Be fully self-contained in a single HTML file (all JS bundled inline)
- Work offline for signing operations
- Be distributable on-chain as a single Hive post plus its comments (each post/comment body has a ~65KB limit; chunks are split at 55KB for a safe margin, resulting in ~4 comments per wallet)
- Run in any modern browser on desktop or mobile, with no installation required
- Connect directly to public Hive API nodes (e.g. `api.hive.blog`, `api.deathwing.me`) with no dependency on custom infrastructure

**Phase 2 readiness:** The wallet codebase includes the infrastructure for traffic obfuscation, per-user endpoint discovery, and proxy support (Phase 2 features), but these capabilities are hidden from the UI in Phase 1. They are present in the code but not exposed to the user. When Phase 2 infrastructure becomes available, these features are activated via a configuration change or wallet update — no architectural changes required.

### 1.2 On-Chain Software Distribution

The wallet tool must be distributable entirely via the Hive blockchain itself, with no dependency on external hosting.

- The complete HTML file is embedded on the Hive blockchain, split across a small number of posts
- Reassembly instructions are simple enough for non-technical users: copy text, save as .html, open in browser
- A version identifier and integrity checksum are included on-chain so users can verify they have the correct, untampered file
- Updates follow the same distribution path

#### 1.2.1 Self-Bootstrapping Distribution (v1 Target)

The wallet tool should be capable of **bootstrapping itself from the blockchain**. Rather than requiring users to manually copy and reassemble code from multiple posts, a minimal bootstrap HTML file can pull the full application code automatically.

**Mechanism:**
- A Hive post acts as the distribution root. Its comments each contain a chunk of the application code (JS, CSS, HTML fragments)
- Comments use ordered permlinks (e.g. `part-01`, `part-02`) and `json_metadata` to tag content type
- The bootstrap HTML uses `bridge.get_discussion` to fetch all comments in a single API call, then assembles and executes the code in order
- The root post's `json_metadata` contains a hash manifest: an ordered list of expected comment permlinks and the content hash of each chunk

**Bootstrap security — code injection prevention:**

Anyone on Hive can reply to any post. An attacker could post a comment on the distribution post containing malicious code. If the bootstrap naively processes all comments, or executes any code before verification completes, the attacker's code could run and tamper with the hash verification itself. The following constraints prevent this:

1. **Author filtering**: The bootstrap must only process comments authored by the same account that authored the root post. All other comments are discarded before any processing occurs. The publisher account is hardcoded in the bootstrap HTML.
2. **Manifest verification**: The root post's `json_metadata` contains the expected permlink and content hash for every chunk. The bootstrap verifies each chunk against the manifest using a cryptographic hash (SHA-256).
3. **Verify all before executing any**: The bootstrap must fetch, filter, and verify every chunk before executing any code. No comment content is evaluated, injected into the DOM, or processed in any way until the entire manifest has been validated. If any chunk is missing or fails verification, the bootstrap aborts entirely — no partial execution.
4. **The bootstrap HTML is the trust anchor**: The verification logic lives in the bootstrap file itself, which the user obtained through a trusted channel (direct share, gift card, etc.). On-chain content cannot modify the verification code because no on-chain code executes until verification passes.

**The bootstrap HTML is small enough to share via any channel** — email, messaging apps, QR code, USB, or even a printed card. Once opened in a browser, it fetches and assembles the full app from on-chain data with no further user intervention.

**The bootstrap HTML is the persistent entry point.** Users open the same bootstrap file each time they want to use the wallet. It is the file they bookmark, share, and keep.

**Local caching:**
- After the first successful bootstrap, the assembled wallet is cached in `localStorage`
- On subsequent opens, the bootstrap loader checks the on-chain version hash against the cached version
- If a new version is available, it fetches and caches the update automatically
- If the chain is unreachable (offline, blocked), it falls back to the cached version
- This means the wallet works offline after the first load, and stays up to date when online
- Users who prefer a standalone file can save the assembled wallet as a regular HTML file, but this becomes a static snapshot that will not self-update

**Retrieval cascade — the loader should try multiple paths to reach on-chain data:**
1. Direct Hive API nodes (e.g. `api.hive.blog`, `api.deathwing.me`)
2. User's discovered proxy endpoints (from encrypted memo feed, once Phase 2 is available)
3. Block explorers (e.g. `hiveblockexplorer.com`, `hivehub.dev`) — the code exists within the explorer's rendered HTML and can be extracted via DOM parsing
4. Web archives and search engine caches as a last resort

**V1 requirement:** The first public version of the wallet tool must support self-bootstrapping from at least a direct Hive API node or an RPC proxy. Block explorer fallback and further cascade levels are desirable but can be introduced in later versions.

**Versioning:** Each version is published as a new post (e.g. `wallet-v1`, `wallet-v2`). The bootstrap HTML can include a version check to notify users when an update is available.

### 1.3 Publishing Tooling

A build script that takes the compiled wallet HTML and publishes it to the Hive blockchain. This is developer tooling, not part of the wallet itself.

The script must:
- Take the single-file HTML output from the build process
- Split it into chunks that fit within the Hive comment body limit (55KB each, safe margin under the ~65KB hard limit)
- Post the root post with `json_metadata` containing the hash manifest (ordered list of expected comment permlinks and SHA-256 hash of each chunk's content)
- Post each chunk as a comment on the root post, with ordered permlinks and content type tags in `json_metadata`
- Generate the bootstrap HTML file with the publisher account and root post permlink hardcoded
- Be re-runnable for publishing updates as new posts

### 1.4 Licensing

Propolis Wallet is open source software, licensed under the **MIT License** — consistent with the Hive ecosystem (Hive Keychain, hive-tx, and other major Hive projects all use MIT).

- The canonical license text lives in the GitHub repository as `LICENSE`
- The root Hive post for each published version includes a short license header and a link to the full license on GitHub:
  ```
  Propolis Wallet — MIT License
  Copyright (c) [year] [author]
  Full license: https://github.com/[repo]/blob/main/LICENSE
  ```
- The full license text is not embedded in on-chain comments — a header plus link is sufficient, and avoids wasting space in the distribution post

---

## Phase 2 Requirements — Restricted Access Infrastructure

Phase 2 extends the Phase 1 wallet with capabilities for users in regions where Hive RPC nodes are blocked. It adds the proxy network, traffic obfuscation, endpoint discovery, and onboarding systems.

### 2.1 Per-User RPC Node Discovery via Encrypted Memos

Each user receives their own RPC endpoint information, delivered as encrypted memos on the Hive blockchain.

**Why per-user (not shared)?** A shared encryption key for the endpoint feed is a single point of failure. If any one user leaks the key — intentionally, through compromise, or by simply relaying the decrypted data — all announced endpoints can be discovered and blocked, affecting every user. Per-user feeds ensure:
- Each user can only leak their own endpoints
- Compromised users can be identified (their specific endpoints get blocked)
- Compromised users can be cut off without affecting anyone else
- Different users can receive different endpoints, further limiting blast radius

**Mechanism:**
- The service operator sends encrypted Hive memo transfers to each subscribed user
- Memos are encrypted using Hive's native memo key encryption — only the recipient can decrypt
- Memos contain current working RPC proxy endpoint(s) assigned to that user
- Endpoints are rotated periodically, with new memos sent on a regular schedule
- The wallet tool automatically reads the user's recent transfer history to find and decrypt the latest endpoint memo

**Endpoint assignment strategy:**
- Users may share endpoints in small groups (e.g. 10-20 users) rather than each user getting a unique endpoint, to reduce infrastructure costs
- If endpoints assigned to a group get blocked, the group is subdivided to isolate the source of the leak
- Persistent leakers are removed from the service

### 2.2 Traffic Obfuscation

RPC traffic between the wallet tool and proxy nodes must be obfuscated to resist deep packet inspection (DPI).

- JSON-RPC calls should be wrapped to resemble normal HTTPS web traffic
- Proxy nodes should present as ordinary web services (e.g. a blog, an image host) to casual inspection
- The protocol should be resistant to fingerprinting of Hive-specific method names and payload structures

### 2.3 RPC Proxy Network

A network of proxy nodes that relay RPC requests to actual Hive API nodes.

- Proxy nodes accept obfuscated requests from the wallet tool and forward them as standard RPC calls to Hive API nodes
- Proxy IPs/endpoints rotate and are announced via per-user encrypted memos
- The proxy layer adds no trust requirements — transactions are signed client-side, so proxies only relay signed data and return public blockchain state
- Proxy operators cannot steal funds or forge transactions (they never see private keys)
- Each proxy endpoint is assigned to a small group of users to enable leak tracing
- Gift card onboarding (section 2.4) uses the same proxy endpoints for RPC access; the invite app and bootstrap wallet are served from public URLs (e.g. GitHub Pages, CDN) rather than the proxy

**Scaling consideration:** The initial proof-of-concept deploys a single proxy instance in London (`lhr`) using Fly.io with auto-stop to minimise costs. A second instance in Singapore is planned but not yet deployed. Additional instances in other regions (e.g. US, Frankfurt, Tokyo) should be deployed as users come onboard, scaling with demand rather than provisioning speculatively. Each 256MB shared-CPU instance is lightweight and costs are negligible when auto-stopped, so scaling can be reactive.

### 2.4 Gift Card Onboarding

The primary onboarding mechanism for new users. A QR-based system that provides account provisioning via a scannable code, suitable for physical or digital distribution. Existing Hive systems for account creation and invites have not achieved major growth; the gift card system is novel and designed for instant, autonomous onboarding without human approval bottlenecks.

**Concept:**
A "gift card" (physical card, printout, or digital image) contains a QR code and a 6-character alphanumeric PIN. When scanned, the QR opens a lightweight **invite app** in the browser — a single-purpose onboarding application, separate from the Propolis wallet. The user enters the PIN to decrypt the embedded data, which contains a **claim token** entitling the holder to redeem a specific **promise** — typically creating a Hive account with a username of their choice. The promise type is extensible: while account creation is the initial implementation, a gift card could also promise a HIVE/HBD transfer, an HP delegation, or a combination of actions. Redemption happens within seconds.

The invite app is deliberately separate from the wallet to keep both codebases focused: the invite app handles one-time onboarding (PIN entry, key generation, account claim), while the wallet handles ongoing key management and transactions. After account creation, the invite app hands the user off to the appropriate wallet experience. Initially the invite app is hosted as a static site on GitHub Pages; it can later be migrated to on-chain bootstrapping (using the same mechanism as the wallet, section 1.2.1) if censorship resistance is needed for the onboarding flow.

**Gift card variants:**
Gift cards come in two variants, determined at batch generation time. The variant is a batch-level attribute stored in the encrypted payload as the `variant` field.

1. **Standard invites** — for countries with unrestricted internet access. The encrypted payload does not include proxy endpoints. The invite app uses public Hive API nodes directly for on-chain operations (signature verification, username availability checks). After account creation, the invite app opens `peakd.com/signin?mode=peaklock&account=<username>&r=/trending` with the posting key auto-copied to clipboard — the user pastes their key and sets a 5-digit PIN to log in via PeakLock (Peakd's built-in non-custodial browser key storage). The gift card service does not enroll the new user in the proxy endpoint feed. Standard invites are simpler to operate: the provider does not need proxy infrastructure, only a gift card service and sufficient account creation tokens.

   **Standard invite handoff — staged onboarding:**
   The handoff prioritises getting the user active on Hive immediately, with security upgrades deferred to a follow-up prompt.

   *Stage 1 — Immediate (seconds after account creation):*
   The invite app shows a congratulations screen confirming the account exists on-chain, then guides the user to log into peakd.com using **PeakLock** — Peakd's built-in browser key storage. The invite app auto-copies the posting key to clipboard and opens `peakd.com/signin?mode=peaklock&account=<username>&r=/trending`. The username is pre-filled; the user pastes their posting key and sets a 5-digit PIN. PeakLock stores keys non-custodially in the browser's localStorage. The user is browsing Hive within a minute of account creation.

   **PeakLock** (Peakd's built-in browser key storage) is the primary login method. The invite app opens `peakd.com/signin?mode=peaklock&account=<username>&r=/trending` with the posting key auto-copied to clipboard. The user pastes their key and sets a 5-digit PIN. PeakLock deep link support was added by @asgarth (March 2026).

   *Stage 2 — Follow-up (days later, optional):*
   The gift card service sends a small transfer (e.g. 0.001 HBD) to the new account with a welcome memo containing a link to Hive Keychain setup instructions. This appears in the user's transaction history on Peakd, serving as a gentle nudge to upgrade their security. The memo could link to a guide for installing the Hive Keychain mobile app (Android/iOS) or browser extension (Chrome/Firefox/Brave), which provides better key management and multi-app support than HiveSigner or PeakLock.

   *PeakLock implementation (March 2026):*
   PeakLock is Peakd's built-in browser key storage. It stores posting keys encrypted with a 5-digit PIN in the browser's localStorage (non-custodial). @asgarth added query-string login support: `peakd.com/signin?mode=peaklock&account=<username>` pre-fills the username and opens the PeakLock login form directly. An `&r=<path>` parameter redirects after login (e.g. `&r=/trending`).

   The invite app flow (~2 user actions): tap "Log into Peakd" button (auto-copies posting key to clipboard) → peakd.com opens with username pre-filled → paste posting key → set 5-digit PIN → done.

   *HiveSigner (deprecated for standard invites):*
   HiveSigner was previously used as the OAuth login method. It required ~3-5 user actions (paste username, paste key, click Login, possibly authorize peakd.app) and stored keys semi-custodially on HiveSigner's servers. Replaced by PeakLock direct login which is simpler (fewer steps, no middleman redirect) and non-custodial.

   The handoff flow should be as hand-held as possible — the user has just created their first Hive account and may have no prior blockchain experience. The invite app retains the user's keys in memory during this flow so they can be copied or re-displayed; keys are cleared from memory when the page is closed.

2. **Robust invites** — for countries with restrictive internet where Hive infrastructure may be blocked. The encrypted payload includes one or more proxy endpoint URLs and a locale identifier. The invite app uses these proxy endpoints for all on-chain operations during onboarding. After account creation, the invite app fetches the locale-appropriate Propolis wallet directly from the Hive blockchain (using the same `bridge.get_discussion` chunk-fetching mechanism as the wallet bootstrap — see section 1.2.1) and transitions seamlessly into the wallet via `document.open()/write()/close()`. The gift card service also enrolls the new user in the proxy endpoint feed. Robust invites require the full Phase 2 infrastructure (proxy network, endpoint feed, Propolis wallet published on-chain).

   **Self-bootstrapping architecture:**
   The robust invite app follows a "fat bootstrap" model — the invite app itself IS the bootstrap. The entire onboarding flow (PIN entry, decryption, verification, key generation, username selection, key backup, account claiming) is contained in a single self-contained HTML file (~50–80KB). No code is fetched from the blockchain during the onboarding phase; the proxy endpoints are used only for on-chain RPC calls (signature verification, username availability, account creation). After account creation and key backup, the invite app uses the proxy endpoints to fetch the Propolis wallet from the blockchain, verify its integrity, and replace itself with the wallet — the same mechanism the wallet bootstrap already uses. This means the user never leaves the page, there are no cross-domain issues, and the transition from invite app to wallet is seamless.

   **Wallet transition — detailed mechanism:**
   After the user has backed up their keys and the account has been created on-chain:
   1. The invite app writes the user's state to `localStorage`: proxy endpoints (`propolis_manual_endpoints`), account keys, and username. This uses the same `localStorage` keys the wallet already reads on startup
   2. The invite app fetches the wallet chunks from the blockchain using the locale specified in the gift card payload (e.g. `propolis-wallet-v1-zh` for Chinese users). It uses `bridge.get_discussion` via the proxy endpoints, verifies each chunk's SHA-256 hash against the on-chain manifest, and assembles the complete wallet HTML
   3. The invite app calls `document.open(); document.write(walletHtml); document.close();` — completely replacing itself with the wallet. The old DOM and scripts are garbage collected
   4. The wallet starts up, detects pre-populated credentials in `localStorage`, and enters a **pre-authenticated startup** path — skipping the login screen and landing the user directly in the wallet, already logged in with their new account and proxy endpoints configured

   Step 4 requires new wallet-side logic: the wallet's `app.ts` must detect that keys and username were written by the invite handoff and skip the login screen. The wallet currently reads `propolis_manual_endpoints` and `propolis_bootstrap_memo_key` from `localStorage`; the invite handoff extends this pattern with additional keys for the account credentials.

   **Locale handling:**
   Each robust invite card embeds a `locale` field in the encrypted payload, determining which on-chain wallet variant to fetch after account creation. The locale is a batch-level attribute set at card generation time — all cards in a batch share the same locale. This enables region-specific card designs (e.g. cards for China could adopt a red packet aesthetic for monetary gift cards) and ensures the user receives the wallet in the appropriate language without requiring locale detection or user selection during onboarding.

The invite app adapts its flow based on the variant: the core onboarding steps (PIN entry, verification, username selection, key backup, account claim) are identical, but the RPC access method, post-claim handoff destination, and endpoint enrollment differ. For standard invites, the invite app is hosted on GitHub Pages and redirects the user to peakd.com after account creation. For robust invites, the invite app is a self-contained HTML file that can be hosted anywhere accessible in the target region (GitHub Pages, CDN, or any static host); after account creation it fetches the Propolis wallet from the blockchain and transitions into it directly.

**QR URL structure:**
```
https://<invite-app-url>/invite#<encrypted-blob>
```

- `<invite-app-url>` — a publicly accessible URL hosting the invite app (e.g. GitHub Pages or CDN). This URL is not sensitive.
- `#<encrypted-blob>` — a URL fragment containing PIN-encrypted data. **The fragment is never sent to the server** — this is a browser guarantee.

**Encrypted blob contents** (revealed after PIN decryption):
- `token` — the single-use claim token
- `provider` — the Hive account name of the gift card provider
- `serviceUrl` — the URL of the provider's gift card service (for redemption requests)
- `variant` — `"standard"` or `"robust"` (determines flow behaviour; see Gift card variants above)
- `endpoints` — *(robust only)* one or more proxy endpoint URLs from the **dedicated onboarding pool** (separate from the subscriber endpoint pool). Used by the invite app for RPC access during onboarding. These endpoints have a one-week grace window and are not passed to the wallet for long-term use — the wallet receives fresh per-subscriber endpoints via the endpoint feed after enrollment. Omitted or empty for standard invites
- `locale` — *(robust only)* the locale code for the wallet variant to fetch from the blockchain after account creation (e.g. `"en"`, `"zh"`, `"ar"`, `"fa"`, `"ru"`, `"tr"`, `"vi"`). Determines which on-chain wallet post to fetch (e.g. `propolis-wallet-v1-zh`). Set at batch generation time. Omitted for standard invites (which redirect to peakd.com rather than bootstrapping a wallet)
- `batchId` — identifier of the batch this card belongs to
- `expires` — expiry date of the token (ISO 8601)
- `signature` — digital signature from the provider's memo key over the card's data (see Authenticity below)
- `promiseType` — the type of promise this card makes (e.g. `account-creation`, `transfer`, `delegation`)
- `promiseParams` — (optional) type-specific parameters for the promise (e.g. `{ "amount": "10.000 HIVE" }` for a transfer card)

**PIN protection:**
- Each gift card includes a 6-character alphanumeric PIN, printed on the card alongside the QR code (in future versions, hidden under scratch-off foil)
- The PIN decrypts the QR fragment data using AES-256-GCM with a key derived via a suitable KDF
- Without the PIN, the QR reveals only the public invite app URL — no proxy domains, claim tokens, or provider information are exposed
- **Threat model:** The PIN protects against casual and automated scanning (e.g. surveillance systems bulk-scanning QR codes). A determined adversary who physically intercepts both the card and the PIN obtains everything, but this is inherent to physical distribution. The 6-character alphanumeric space (~2.2 billion combinations) provides meaningful resistance to brute-force attempts against captured QR data.

**Claim tokens:**
- The gift card service pre-generates a batch of single-use claim tokens when producing gift cards
- Each token is a cryptographic secret that authorises one redemption of the batch's promise (e.g. account creation, token transfer, HP delegation)
- All tokens in a batch share the same promise type — the type is a batch-level attribute
- Tokens are stored in a SQLite database on the gift card service, mapped to their redemption status, batch, and expiry
- A token can only be redeemed once — after fulfilment, it is marked as spent
- **Expiry:** Tokens expire after a configurable period (default: 1 year). The expiry date should be clearly printed on the gift card. Expired tokens cannot be redeemed, freeing the provider from reserving account creation tokens indefinitely for cards that may have been lost, abandoned, or destroyed

**On-chain batch declaration:**
When a batch of gift cards is generated, the provider broadcasts a `custom_json` transaction declaring the batch on-chain. This creates a public, immutable record of issuance. The declaration includes:
- Batch ID
- Number of tokens in the batch
- Expiry date
- Promise type (e.g. `account-creation`, `transfer`, `delegation`)
- Promise parameters (if applicable, e.g. `{ "amount": "10.000 HIVE" }`)
- A Merkle root of the token hashes (SHA-256 of each token), which commits to the full set of tokens without revealing them individually

This enables anyone to verify that a specific token belongs to a declared batch (by providing the Merkle proof), and provides transparency into how many tokens a provider has allocated to gift cards and what they promise.

**Authenticity signature:**
Each gift card includes a digital signature from the provider's memo key, proving the card was genuinely issued by the stated provider. The signature is over a canonical string of the card's data:

```
<token>:<batchId>:<provider>:<expires>:<promiseType>
```

The `promiseType` field in the canonical string ensures that a signature for one type of card (e.g. `account-creation`) cannot be reinterpreted as a different type (e.g. `transfer`). The signature is included in the encrypted blob. On decryption, the invite app verifies the signature against the provider's public memo key (which is available on-chain via `condenser_api.get_accounts`). If verification fails, the invite app rejects the card as counterfeit. This prevents an attacker from creating fake gift cards that claim to be from a legitimate provider.

**Gift card service:**
The gift card service is a **separate service from the RPC proxy**, deployed independently. This separation exists for two reasons:
1. **Security isolation.** The gift card service holds sensitive keys — either the provider's active key or account creation token authority — needed to create Hive accounts. The proxy holds no such keys.
2. **Multi-operator support.** Any Hive account with sufficient account creation tokens can run their own gift card service independently. This enables Hive whales to operate their own gift card programs, potentially earning a return on their Hive Power by selling account creation as a service.

**Multi-provider accounts:**
A single gift card service instance supports multiple provider accounts. Other Hive users can request to be added as providers on an existing gift card service. The workflow is:

1. A Hive user submits a request to the gift card service operator to be added as a provider
2. The operator reviews and approves the request
3. The approved provider delegates their account's active key authority to the gift card service's `invite-authority` active key (via `update_account` to add the service's public active key to their account's active authority list)
4. The gift card service can now broadcast `create_claimed_account` transactions on behalf of the provider, consuming the provider's own account creation tokens

This enables providers who do not want to run their own infrastructure to participate in gift card distribution by leveraging an existing service operator's deployment. The provider supplies the account creation tokens (earned through Hive Power), and the service operator supplies the infrastructure.

**Trust and security considerations for delegating providers:**
Delegating active key authority to a third-party service is a significant trust decision. The active key controls account creation tokens, token transfers, and other high-value operations. Providers considering this delegation should be aware of the following:

- They are trusting the service operator not to misuse their active key authority (e.g. transferring funds, changing account settings)
- They should set up **key monitoring** on their account to detect any unexpected operations — anything other than `create_claimed_account` and `delegate_vesting_shares` (the only operations the gift card service should perform). Hive ecosystem tools exist for this (e.g. account history watchers, custom_json monitors)
- They can **revoke the delegation at any time** by removing the service's public key from their active authority (via Peakd, Hive Keychain, or any wallet that supports `update_account`)
- They should consider starting with a small allocation of account creation tokens to limit exposure while building trust with the operator
- The service operator should clearly communicate the scope of operations the service will perform on their behalf

The gift card service itself has no obligation beyond making providers aware of the trust implications at onboarding time. Key monitoring, risk management, and revocation decisions are the provider's responsibility.

**On-chain service discovery:**
Gift card providers register their service URL on-chain so the invite app can discover it from the provider account name. Registration is via `custom_json` on the provider's account or via a transfer memo to a known discovery account. This enables the invite app to look up the service URL at redemption time without the QR needing to embed a domain that might change.

Note: The QR's encrypted blob also includes the `serviceUrl` directly as a fallback, so the invite app can contact the service even if on-chain lookup fails. The on-chain record is the canonical source and takes precedence when available.

**Flow:**
1. Gift card provider generates a batch of claim tokens with a configured variant and expiry (default: 1 year), signs each card's data with the provider's memo key, broadcasts a batch declaration `custom_json` on-chain, and produces gift cards with unique QR codes and PINs
2. Gift cards are distributed (in person, by post, via trusted channel)
3. User scans QR → phone opens browser → invite app loads from the public URL (e.g. GitHub Pages)
4. Invite app detects the encrypted fragment and prompts the user to enter the PIN from the gift card
5. Invite app decrypts the fragment, extracting the claim token, provider account, batch ID, service URL, variant, authenticity signature, and (for robust invites) proxy endpoints. The fragment is immediately cleared from the address bar
6. Invite app looks up the provider's public memo key on-chain and verifies the authenticity signature. For robust invites, this uses a proxy endpoint from the decrypted data; for standard invites, this uses public Hive API nodes directly. If verification fails, the invite app rejects the card as counterfeit
7. Invite app generates keys locally and prompts the user to choose a username
8. Invite app prompts the user to back up their keys (QR code export, manual copy, or both) **before** proceeding
9. Invite app sends an account creation request to the gift card service, including: the claim token, the user's chosen username, and the user's public keys
10. Gift card service validates the token (not expired, not already spent), creates the Hive account on-chain, delegates a small amount of HP to the new account (so the user has enough Resource Credits to transact), and marks the token as spent
11. *(Robust only)* Gift card service sends a transfer to the endpoint subscription service (e.g. `haa-service`) with the new account's username in the memo, signalling that this user should be enrolled in the endpoint feed. This step is skipped for standard invites
11a. *(Robust only)* Invite app verifies enrollment by polling the endpoint feed (via the onboarding proxy endpoints) to confirm the new username appears. If confirmed, proceeds immediately. If not confirmed within ~60 seconds, proceeds anyway with a reassuring message — enrollment will complete asynchronously. The goal is reliability: the user should never be blocked by a transient feed delay
12. Invite app confirms account creation and begins the handoff flow. For **standard invites**, the invite app congratulates the user and redirects them to peakd.com via HiveSigner (OAuth login — no install required). For **robust invites**, the invite app: (a) generates a personalized bootstrap file containing the user's master password encrypted with the gift card PIN (via Argon2id + AES-256-GCM) and the onboarding proxy endpoint URLs (as a bridge until subscriber endpoints arrive), (b) prompts the user to save this file to their device for future wallet access, (c) writes credentials and the onboarding proxy endpoints to `localStorage`, (d) fetches the locale-appropriate Propolis wallet from the Hive blockchain (using the `locale` field from the gift card payload to determine the on-chain permlink), verifies chunk integrity against the on-chain hash manifest, and replaces itself with the assembled wallet via `document.open()/write()/close()`. The wallet detects the pre-populated credentials and starts in pre-authenticated mode — the user lands directly in a working wallet, logged in, with onboarding proxy endpoints configured. Once the endpoint feed delivers subscriber endpoints (typically within hours), the wallet transitions to those and the onboarding endpoints are no longer needed

**Integration with existing infrastructure:**
- For **standard invites**, the invite app is a lightweight static site hosted on GitHub Pages (or any public CDN). It uses public Hive API nodes directly and redirects the user to peakd.com via HiveSigner OAuth login (no install required). PeakLock is available as a fallback. Hive Keychain is recommended as a follow-up upgrade via transfer memo. No proxy infrastructure is required
- For **robust invites**, the invite app is a self-contained HTML file (~50–80KB) that can be hosted anywhere accessible in the target region. It uses proxy endpoints from the encrypted gift card payload for all on-chain operations. After account creation, it fetches the Propolis wallet from the blockchain using the same chunk-fetching and hash-verification mechanism as the wallet bootstrap (section 1.2.1), then replaces itself with the wallet via `document.open()/write()/close()`. The wallet receives pre-populated credentials and proxy endpoints via `localStorage` (same-origin, since the page never navigates) and starts in pre-authenticated mode. This self-bootstrapping architecture means the robust invite flow has no external dependencies beyond a reachable Hive RPC endpoint (via proxy) — no cross-domain redirects, no separate wallet hosting, and no install steps
- The gift card service is independent of both the invite app and the proxy — it only needs to reach a Hive API node (directly or via proxy) to broadcast the account creation transaction
- The wallet must support a **pre-authenticated startup** path: when it detects invite-handoff credentials in `localStorage` (username + keys written by the invite app), it skips the login screen and starts the user directly in the authenticated wallet experience. This extends the existing pattern where the wallet reads `propolis_manual_endpoints` and `propolis_bootstrap_memo_key` from `localStorage`

**Endpoint subscription enrollment** *(robust invites only)*:
When the gift card service creates a new account via a robust invite, it signals the endpoint subscription service by sending a small transfer (e.g. 0.001 HBD) to the service account (e.g. `haa-service`) with the new username in the memo. The endpoint feed publisher (section 2.1) recognises this as a subscription request and includes the new user in the next feed update. This keeps the feed publisher's keys separate from the gift card service's keys. For standard invites, this step is skipped — the new user accesses Hive through public API nodes and does not need proxy endpoints.

The invite app **verifies enrollment** after the gift card service signals it. Using the embedded proxy endpoints (which are distinct from the subscriber endpoint pool — see "Proxy endpoint exposure and isolation" in open questions), the invite app polls the endpoint feed to confirm the new username has been enrolled. This verification is best-effort: if confirmed, the invite app can inform the user that everything is set up; if not confirmed within a timeout, the invite app proceeds with a reassuring message that enrollment will complete shortly. The imperative is that the user leaves the onboarding flow confident that their setup is complete and functional.

**Proxy endpoint isolation:** The proxy endpoints embedded in robust invite cards are drawn from a **dedicated onboarding pool**, separate from the endpoints delivered to regular subscribers via the endpoint feed. This ensures that (a) compromise of an invite card's endpoints does not expose subscriber infrastructure, and (b) onboarding endpoints can be rotated on a batch-by-batch basis without disrupting active wallet users. The onboarding endpoints have a **one-week grace window** — they remain valid for at least 7 days after card redemption, providing a guaranteed bridge until the subscriber feed delivers fresh per-user endpoints. After the grace window, the wallet relies entirely on subscriber endpoints from the feed.

**Persistent wallet access** *(robust invites only)*:
After the initial onboarding session, the user needs a way to return to the Propolis wallet in future browser sessions. The robust invite flow addresses this by generating a **personalized bootstrap file** that the user saves to their device.

*Mechanism:*
After account creation and before transitioning to the wallet, the invite app generates a lightweight bootstrap HTML file (~47KB) containing:
- The user's proxy endpoint URLs (for fetching the wallet from the blockchain)
- The user's master password, encrypted with the gift card PIN using AES-256-GCM with an Argon2id-derived key
- The on-chain wallet permlink and hash manifest for the user's locale
- The same chunk-fetching and hash-verification logic used by the standard wallet bootstrap (section 1.2.1)

The invite app prompts the user to save this file to their device (via download or share sheet). The user is instructed that this file, combined with their gift card PIN, is all they need to access their wallet in the future.

*Returning to the wallet:*
1. User opens the saved bootstrap file in their browser
2. Bootstrap prompts for the gift card PIN
3. PIN decrypts the master password via Argon2id + AES-256-GCM
4. Bootstrap derives all account keys from the master password
5. Bootstrap fetches the latest wallet from the blockchain via embedded proxy endpoints
6. Bootstrap writes credentials and endpoints to `localStorage`, then transitions to the wallet via `document.open()/write()/close()`
7. Wallet starts in pre-authenticated mode — the user is logged in immediately

*KDF parameters:*
The PIN is only ~31 bits of entropy (6 alphanumeric characters). Since it protects a permanent credential (the master password), the KDF must be tuned aggressively to resist offline brute-force attacks on a captured file. Argon2id is the recommended KDF, with parameters tuned to take ~1–2 seconds on a mid-range mobile device (the primary platform, since users enter via QR scan). This balances usability against brute-force resistance — at 1 second per attempt, exhausting the ~2.2 billion PIN space takes ~70 years on a single core. GPU parallelism reduces this, but the memory-hard property of Argon2id limits GPU advantage compared to PBKDF2 or bcrypt.

*Gift card as recovery artifact:*
The physical gift card serves a dual purpose: initial onboarding (claim token via QR) and ongoing recovery (PIN for decrypting the saved bootstrap file). The card's printed instructions should clearly indicate that the card should be **kept as a backup** after use — it is not a disposable artifact. The PIN remains useful indefinitely, even after the claim token has expired or been spent. The card design should include text such as: "Keep this card safe — you will need the PIN to access your wallet."

The master password backup (screenshot/manual copy from the key backup screen) remains an independent recovery path. Even if the user loses both the saved bootstrap file and the gift card, they can recover their account by entering the master password into any Propolis wallet instance with proxy access. The PIN-encrypted bootstrap is an additional, more convenient recovery mechanism — not a replacement for the master password backup.

*Future enhancement — recovery key for monetary gift cards:*
For gift cards that attach monetary value (e.g. `promiseType: "transfer"`), a stronger recovery key (12–16 alphanumeric characters) could be printed on the card alongside or in place of the PIN for bootstrap encryption. This recovery key would not be needed during the onboarding flow (which continues to use the 6-character PIN for QR decryption), so it adds no friction to the initial experience. It would only be entered when reopening the saved bootstrap file. The architecture should support a generic passphrase input for bootstrap decryption rather than hardcoding the PIN, so this upgrade is a card-design and generation-pipeline change, not an invite app change.

**Security:**
- Private keys are generated locally on the user's device and never transmitted — only public keys are sent to the gift card service
- The claim token is a single-use secret; once redeemed it cannot be used again
- The invite app clears the URL fragment from the address bar immediately after decryption
- PIN encryption ensures the QR code alone reveals nothing about proxy infrastructure or claim tokens
- **Authenticity verification:** Each card carries a digital signature from the provider's memo key. The invite app verifies this signature on-chain before proceeding, preventing counterfeit cards from impersonating a legitimate provider
- **On-chain batch transparency:** Batch declarations are recorded on-chain, providing a public audit trail of issuance. The Merkle root commitment allows individual tokens to be verified as belonging to a declared batch
- If a gift card is intercepted (QR + PIN), the attacker can create an account but the original user's card simply fails to redeem — no funds are at risk since the account is empty at creation
- The gift card service never sees private keys — it receives only public keys and broadcasts a standard `create_claimed_account` transaction

**Accountability & auditability:**
Gift card issuers make promises on-chain (via batch declarations) and must demonstrably fulfil them. The system provides the building blocks for third-party auditing so that a user scanning a gift card can assess whether the issuer has historically honoured their commitments.

*On-chain fulfilment linking.* Every promise-type handler **must** include `SHA-256(token)` — the hash of the raw claim token — in the on-chain transaction that fulfils the promise. For account creation this is the `giftcard_token_hash` field in the new account's `json_metadata`. For future promise types (transfer, delegation) this should be in the transaction memo or an accompanying `custom_json`. The token hash — not the raw token — is published, so the token remains secret until the holder chooses to reveal it.

This creates a verifiable chain: batch declaration (merkle root + count + promise type) → individual fulfilment TXs (each tagged with a token hash that can be verified against the merkle root). An auditor can count declared tokens vs. fulfilled token hashes for any issuer and identify shortfalls.

*Merkle membership proofs.* A claimant who holds a token can hash it and, given a merkle proof path, verify membership in the on-chain batch root. The gift card service can provide merkle proof paths on request. This allows a claimant (or any third party given a revealed token) to prove that a specific token was part of a legitimately declared batch.

*Future considerations* (not yet implemented but architecturally supported):
- **Signed claim receipts:** The gift card service could sign a receipt at claim time (token hash, timestamp, batch ID, fulfillment TX ID) using the provider's memo key, giving the claimant cryptographic evidence of their claim attempt.
- **Claimant-published claim records:** For non-account-creation promise types where the claimant already has a Hive account, the claimant could publish their own `custom_json` claim record before the service fulfils, creating an independent on-chain timeline that the issuer cannot deny.
- **Issuer reputation scoring:** By aggregating batch declarations and fulfilment TX counts across an issuer's history, a wallet could display a trust score when a user scans a gift card from that issuer.
- **Robust invite celebration UX A/B testing:** The initial robust success screen design is deliberately understated (checkmark + text confirmation). A future iteration may experiment with more celebratory confirmation UX (animations, illustrations, etc.) and A/B test the effect on engagement and flow completion rates. The screen architecture should accommodate swapping the confirmation component without affecting the blocking file save or wallet loading phases.

**Limitations:**
- **Invite app accessibility in restricted regions.** The invite app URL in the QR must be accessible in the user's region. For standard invites, GitHub Pages is sufficient. For robust invites targeting restricted regions, the invite app is served via a censorship-resistant hosting layer (see resolved question 2 below). The QR URL uses a custom domain controlled by the project, allowing DNS-level failover between hosting providers without reprinting cards. The domain should be acquired before any robust invite cards are printed, as the URL is baked into physical cards and cannot be changed retroactively
- Gift cards have a shelf life determined by both the token expiry (default: 1 year) and the longevity of the invite app URL and service URL
- The gift card service must be reachable at redemption time — if the service is down, the token remains valid for later use (assuming it has not expired)
- The initial HP delegation is a cost borne by the gift card provider; it should be small enough to enable basic transactions but represents a capital commitment that is recovered when the delegation is eventually removed
- After account creation, the user must transition from the invite app to their target wallet experience. For robust invites, the invite app generates a personalized bootstrap file for the user to save, then fetches the wallet from the blockchain and transitions into it seamlessly via `document.open()/write()/close()` — no cross-domain redirect or manual steps required. For standard invites, the invite app opens `peakd.com/signin?mode=peaklock&account=<username>&r=/trending` with the posting key auto-copied to clipboard — the user pastes their key and sets a 5-digit PIN (~2 user actions). PeakLock stores keys non-custodially in the browser's localStorage. The invite app retains keys in memory throughout this handoff so the user can re-access them if needed
- **TLS certificate acceptance for LAN deployments:** When the gift card service runs on a local network (e.g. internet café, community centre, offline kiosk) rather than behind a public domain with a valid certificate, the invite app's `fetch()` requests to the service will silently fail unless the user has previously accepted the self-signed certificate warning by visiting the service URL directly. This is a browser security constraint — `fetch()` to an untrusted HTTPS origin is rejected without user interaction, and the invite app cannot trigger the browser's certificate acceptance UI programmatically. A future UX improvement could detect LAN/IP-based service URLs and prompt the user to verify the connection (opening the service health endpoint in a new tab) before attempting the claim. This is not an issue for public deployments with valid TLS certificates (e.g. Let's Encrypt)

**Open questions (robust invites):**

The following design questions were identified during requirements review (March 2026) and deferred for future discussion.

1. **Endpoint feed enrollment timing — RESOLVED.** The embedded proxy endpoints in robust invite cards have a **one-week grace window** — they are guaranteed to remain valid for at least 7 days after the card is redeemed. This gives the endpoint feed system time to process the enrollment and deliver fresh endpoints to the user's wallet. The proxy infrastructure must not rotate or decommission any endpoint that is embedded in an unredeemed or recently-redeemed robust invite batch until the grace window expires. The invite app **verifies enrollment success** after account creation: it polls the endpoint feed (via the embedded proxy endpoints) to confirm that the new username appears in the feed. If enrollment is not confirmed within a reasonable timeout (e.g. 60 seconds), the invite app displays a warning with guidance (e.g. "Your account was created successfully, but endpoint enrollment is still processing. Your wallet will work normally — fresh endpoints will arrive within a few hours."). This verification step prioritises reliability: the user should never be left wondering whether the flow completed.

2. **Invite app hosting accessibility — RESOLVED.** GitHub Pages is not accessible in key target regions (China, Iran) and cannot serve as the invite app URL for robust invites. The solution is a **layered hosting strategy** with DNS-level failover:

   **Architecture:**
   - The QR code contains a URL on a **custom domain controlled by the project** (e.g. `invite.example.com/CARD_ID`). This domain is what gets printed on physical cards — it must never be a third-party platform domain (`*.fly.dev`, `*.pages.dev`, `*.github.io`) because changing it requires reprinting cards.
   - The **primary hosting layer** is a censorship-resistant CDN such as Cloudflare Workers. Cloudflare's IP ranges are shared by millions of sites, making wholesale IP-based blocking extremely costly for censors. Cloudflare Workers can serve the invite app HTML directly at the edge with low latency globally. The invite app is static HTML — no server-side state or persistent connections required — so Workers' constrained runtime is not a limitation for this use case.
   - **DNS failover** provides resilience: if the primary CDN is blocked in a specific region, the custom domain's DNS can be repointed to an alternative provider (e.g. Fly.io, a VPS, or another CDN) without changing the QR URL. This is an operational response, not automatic — it requires monitoring and manual DNS updates, but the printed cards remain valid.
   - The invite app, once loaded, uses the **embedded proxy endpoints** from the gift card payload for all Hive API calls. The page-serving infrastructure and the API proxy infrastructure are separate concerns: Cloudflare serves the page, Fly.io proxies handle API calls.

   **Fallback URLs within a single QR** are not viable for the initial page load. A QR code contains one URL — if that URL is blocked, no client-side fallback can execute because the browser never receives any code. Fallback logic is only useful *after* the invite app loads (e.g. trying multiple proxy endpoints for API calls), which is already handled by the embedded endpoint list.

   **Telegram bot as printed fallback:** The robust invite card should include a short printed instruction alongside the QR: e.g. "Can't scan? Message @PropolisBot on Telegram". The Telegram bot (which already exists for gift card distribution) can deliver the invite app HTML as a file or provide an alternative URL. This covers the extreme case where all web-based approaches fail, while keeping the card self-contained — the fallback information is printed on the card itself, requiring no additional materials. This is a last-resort path, not the primary flow.

   **Domain acquisition timing:** The domain does not block development of the invite app, but must be acquired before any robust invite cards are printed. Early acquisition allows testing with the real domain and avoids last-minute DNS propagation issues.

   **Decisions deferred:** Specific domain name selection, Cloudflare Workers vs. alternative CDN evaluation, and Telegram bot `/claim` flow design are implementation details to be resolved when robust invite development begins.

3. **Proxy endpoint exposure and isolation — RESOLVED.** Robust invites use **distinct proxy endpoints** that are separate from the regular subscriber endpoint pool. This isolation means that if a robust invite endpoint is compromised or leaked, it does not expose the infrastructure used by existing wallet subscribers. The design supports **proxy rotation**: the embedded endpoints are valid for the one-week grace window (see question 1), during which time the endpoint feed enrolls the user and begins delivering fresh, per-subscriber endpoints through the normal feed mechanism. The embedded endpoints are therefore **onboarding-only** — they bridge the gap until the user transitions to the subscriber endpoint pool. At the batch level, all cards in a batch share the same embedded endpoints (per-card endpoints would bloat the QR payload and complicate generation). The blast radius of a leaked batch endpoint is limited to the grace window duration and the onboarding traffic pattern, which is low-volume and transient. The proxy infrastructure should support rotating batch endpoints independently of subscriber endpoints, so a compromised batch can be mitigated without disrupting active users.

4. **Robust invite success screen UX — RESOLVED.** The robust invite flow uses a **separate build target** with its own success screen, not conditional logic within the standard success screen. The invite app codebase produces two HTML bundles via Vite multiple entry points:
   - `invite-standard.html` — hosted on GitHub Pages, includes HiveSigner/peakd.com handoff logic
   - `invite-robust.html` — hosted on Cloudflare Workers, includes chunk-fetching/hash-verification and bootstrap file generation logic

   Shared screens (landing, PIN entry, decryption, username selection, key backup) live in common modules. Variant-specific screens (`success.ts` vs `success-robust.ts`) are separate files. Each build tree-shakes the other variant's dead code, keeping bundles focused and avoiding runtime variant conditionals throughout the app.

   **Robust success screen flow** — three sequential phases within one screen:

   *Phase 1 — Confirmation (brief).* A checkmark icon and "Account @username created" with the transaction ID. Understated — no celebration banners or animations. The user is in a restricted-internet context; they need reassurance that it worked, not confetti. This phase is visible for 2–3 seconds before the user's attention moves to the action below.

   *Phase 2 — Bootstrap file save (blocking).* A prominent card: "Save your wallet file." Brief explanation: "This file is how you'll access your wallet in the future. You'll need it together with your gift card PIN." A download button triggers the browser's save dialog. After the download fires, a confirmation checkbox appears: "I've saved my wallet file" — the "Continue" button remains disabled until checked. This mirrors the key backup screen's enforcement pattern. The save is **blocking** because without the bootstrap file, a user in a restricted environment has no practical way to return to the wallet — the invite URL may become unreachable, the claim token is spent, and finding another Propolis wallet instance requires the very internet access they lack. The master password backup from the earlier screen is an emergency fallback, not a daily-access mechanism.

   *Phase 3 — Wallet loading (progress).* "Loading your wallet..." with a **determinate progress bar** showing chunk-fetching progress (e.g. "Fetching wallet: chunk 2 of 4") and a time estimate ("Usually takes 10–20 seconds"). The progress is real — each chunk fetch updates the bar. When all chunks are fetched and verified, a brief "Ready" state (1 second), then automatic transition to the wallet via `document.open()/write()/close()`. The wallet detects pre-populated credentials in `localStorage` and starts in pre-authenticated mode.

   **Enrollment verification** runs concurrently with Phase 3 (wallet loading). If enrollment is not confirmed within 60 seconds, the wallet loading still completes — the user sees a non-blocking notice: "Your account was created successfully, but endpoint enrollment is still processing. Your wallet will work normally — fresh endpoints will arrive within a few hours." This notice appears briefly before the wallet transition and is not a blocker.

5. ~~**`variant` field missing from `GiftCardPayload` type.** The `GiftCardPayload` interface in `invite/src/types.ts` does not include a `variant` field. The requirements specify `"standard"` or `"robust"`. Without it, the invite app can only infer the variant from `endpoints.length > 0`, which is fragile (a standard invite with accidentally empty endpoints would be misclassified). The `locale` field (for determining which wallet to fetch) is also missing from the type. Both should be added.~~ ✅ **RESOLVED** — both `variant: 'standard' | 'robust'` and `locale?: string` fields have been added to `GiftCardPayload` in `invite/src/types.ts`.

6. **Offline/degraded network during robust invite flow — RESOLVED.** Robust invites target users with restricted internet, so partial connectivity is a likely scenario.

   **(a) Manual proxy endpoint entry.** The invite app will support manual proxy endpoint entry as a fallback for when embedded endpoints are blocked at claim time. This is **deferred from the first iteration** — the initial release relies solely on the embedded endpoints from the gift card payload. Manual entry will be added in a subsequent iteration once the core robust flow is validated. The architecture should not preclude this (e.g. the endpoint configuration path should accept endpoints from any source, not be hardcoded to the payload).

   **(b) Retry with backoff.** All proxy-dependent network requests (verification, username availability, claiming, wallet chunk fetching) use retry logic with exponential backoff. If the payload contains multiple proxy endpoints, failed requests rotate through them before exhausting retries. This is standard resilience for unreliable network conditions and should be implemented from the first iteration.

   **(c) Guidance on unreachable gift card service.** When the gift card service is unreachable through the proxy, the user sees specific guidance rather than a generic error. The exact messaging is to be determined during implementation, but the principle is: the user should understand (1) the gift card is still valid and has not been consumed, (2) the problem is connectivity not the card, and (3) what they can try (retry, try later, contact support via Signal if printed on card). The error screen must not be a dead end — it should offer actionable next steps.

   **(d) Intermediate state caching.** The invite app caches intermediate state to `sessionStorage` at key checkpoints (after successful verification, after username selection, after key generation/backup). If connectivity drops mid-flow and the user refreshes or returns to the page, the app detects cached state and offers to resume from the last checkpoint rather than restarting from scratch. The encrypted blob is consumed on first load and cannot be re-read from the URL, so caching is the only way to support resumption. Cached state is cleared on successful completion or explicit abandonment. The claim token remains valid until redeemed, so resuming a partially-completed flow is safe as long as the token has not expired.

7. **Gift card generation pipeline for robust batches — RESOLVED.** The existing `giftcard-generate.ts` script needs to support robust invite generation. The current script reads endpoints from a local `feed-config.json` file, but has no concept of variant, locale, or dedicated endpoint pools.

   **(c) Locale — RESOLVED.** The `locale` field is a per-batch CLI flag (e.g. `--locale zh`) matching the wallet locale codes (`en`, `zh`, `ar`, `fa`, `ru`, `tr`, `vi`). Locale and variant (`--variant standard|robust`) are independent flags — a batch can be standard `zh` (for Taiwan or overseas Chinese) or robust `zh` (for mainland China). Neither flag implies the other.

   **(a) Onboarding pool endpoint sourcing — RESOLVED.** Endpoints are delivered via **encrypted on-chain memo** from `haa-service` to the giftcard provider account, reusing the existing feed mechanism that already delivers subscriber endpoints. The giftcard provider account is enrolled as a special recipient that receives onboarding pool endpoints (distinct from the subscriber pool, per open question 3). The generation script reads the latest memo from `haa-service`, decrypts it with the provider's private memo key, and extracts the onboarding endpoint list.

   This approach was chosen over a dedicated API endpoint because it: (1) requires zero additional infrastructure — reuses the proven feed mechanism, (2) avoids a new API surface that would need deployment, maintenance, URL bootstrapping, and mutual authentication, (3) provides implicit server authentication — the memo sender is verifiable on-chain as `haa-service`, eliminating the risk of a network adversary serving fake endpoints from a spoofed API, and (4) produces no new network metadata — the generation script's only network activity is standard Hive API calls, indistinguishable from normal blockchain usage.

   The current `feed-config.json` approach remains available as a manual override for testing or airgapped generation, but robust production batches should use the on-chain memo source. Per-locale onboarding pools are a future consideration but not required for the first iteration — initially, all robust batches share one onboarding pool.

   **(b) Endpoint liveness validation — RESOLVED.** After sourcing endpoints from the on-chain memo, the generation script **directly probes each endpoint** with a lightweight health check before embedding it in cards. This is safe because the generation script is operated by the same party who operates the proxies — probing your own infrastructure reveals nothing to an adversary. Any endpoint that fails the health check is excluded from the batch, and generation aborts if fewer than a minimum threshold of endpoints are live (the threshold is configurable, defaulting to at least 2 live endpoints). This ensures that gift cards are never produced with dead or unreachable endpoints, which would be unrecoverable for users in restricted regions with no fallback.

   **(d) Batch declaration `custom_json` fields — RESOLVED.** No additional on-chain fields are needed for robust batches. The batch declaration exists for one purpose — trustless Merkle proof validation at claim time — and the existing fields (`batch_id`, `count`, `expires`, `merkle_root`, `promise_type`, `promise_params`) are sufficient for that. Variant, locale, endpoint count, and grace window duration are **operational metadata**. Publishing them on the public blockchain would create a permanent record of operational patterns (distribution cadence, target regions, batch sizes) with no functional benefit — none of these fields are needed for token validation. This metadata already lives in the local `manifest.json` produced by the generation script, which is sufficient for operator bookkeeping. Where the claim service needs to distinguish robust from standard (e.g. to trigger endpoint feed enrollment), it learns this from the `/claim` request itself — the invite app knows its own variant and includes it in the request.

**Secure support channel:**

Users in restricted regions — particularly mainland China — will encounter difficulties during onboarding and instinctively seek help on familiar platforms (WeChat, QQ). These platforms are actively surveilled; sharing gift card PINs, screenshots, or proxy URLs on them risks exposing the user, consuming the card (if an observer claims it first), and revealing proxy infrastructure to censors.

The mitigation strategy has two parts: (1) reduce the need for external help by making the invite flow self-explanatory with inline guidance and clear error messages, and (2) provide a secure support channel for when help is genuinely needed.

**Signal as the primary support channel.** Signal is preferred over Telegram for the highest-risk regions because of its stronger metadata protection (sealed sender, no server-side message retention) and lower profile with Chinese authorities compared to Telegram. The support channel is a **dedicated Signal number** operated by the gift card provider, not a group chat. Rationale:

- **No group invite link to leak.** A group invite link shared on WeChat would defeat the purpose — anyone (including surveillance actors) could join. A 1:1 support number avoids this entirely.
- **No member exposure.** Group chats expose member phone numbers to admins and potentially to other members. 1:1 conversations expose only the support number, which is already public.
- **No moderation overhead.** Groups require active moderation to prevent spam, scams, and off-topic discussion. A support number is point-to-point.
- **Signal lacks bot support.** Unlike Telegram, Signal has no bot API, so a group chat cannot be automated. A support number staffed by the provider (or a small team) is the natural model.

**Integration points:**

- **Printed gift cards** include the Signal support number (or `signal.me` deep link) alongside the QR code and PIN, with text in the target locale: "Need help? Contact us on Signal." No warnings about specific platforms — the card should feel like a normal gift, not something dangerous.
- **Invite app error screens** (unreachable gift card service, network failures, timeout states) display a "Need help?" link that opens the Signal deep link (`https://signal.me/#p/+PHONENUMBER`). This is the actionable fallback when self-service recovery fails.
- **Invite app PIN entry or landing screen** shows a brief, normalised security notice: "This card is personal — don't share the PIN" (analogous to bank card advice). No mention of specific platforms. The goal is to make PIN confidentiality feel like common sense, not to imply the activity is risky or illegal. A "Need help?" link to Signal is shown nearby.
- **Gifter/distributor materials only** (instructions included with card batches): The explicit guidance about platform risks belongs here, not in user-facing materials. Distributors understand the threat model and can exercise judgment in how they brief recipients verbally. Materials should advise: keep card details off public or monitored messaging platforms; direct recipients to Signal for help; explain why (card could be claimed by an observer, infrastructure could be discovered).

**Operational notes:**

- The Signal support number should be a dedicated number (not a personal phone), ideally registered to a VoIP service for operational separation. Signal supports registration via landline voice verification.
- For scaling beyond a single operator, Signal's multi-device support (up to 5 linked devices) allows a small team to share the support number without exposing individual phone numbers.
- The support number is printed on physical cards and embedded in the invite app, so changing it requires reprinting cards and updating the app. Choose the number carefully and plan for longevity.
- **Signal accessibility in restricted regions.** Signal is itself sometimes blocked in China, and Google Play (the primary Android distribution channel) is unavailable. Chinese app stores will not carry Signal. To make Signal practically reachable, the proxy infrastructure serves a second purpose: **Signal APK distribution.** The proxy can cache or relay the official Signal APK (published at signal.org/android/apk) so users can download it through the same proxy endpoints they already use for the wallet. Integration points:
  - **Invite app success screen or help link:** After successful account creation, or on any error screen with the "Need help?" prompt, include a "Download Signal" link that fetches the APK through the proxy. The link is only shown on Android (detected via user agent) since iOS users must use the App Store (which is available in China, and Signal is listed there).
  - **Printed gift cards (robust variant):** A short URL or second QR code that resolves through the proxy to the Signal APK download. This allows the user to install Signal before or independently of the invite flow.
  - **Censorship circumvention guidance:** Once installed, Signal has a built-in "censorship circumvention" toggle (Settings > Privacy) that uses domain fronting via Google/Cloudflare. Brief guidance on enabling this should accompany the download link — it often works in China without a separate VPN.
  - The APK served through the proxy should be verified against Signal's published checksum to prevent tampering. The proxy caches the APK to avoid repeated fetches from signal.org (which may itself be blocked from the proxy's location — if so, the APK is pre-seeded manually by the operator).
  - This is deferred from the first iteration — the initial release includes only the Signal contact number/deep link. APK distribution is added once the core robust flow and proxy infrastructure are validated.

**User testing observations (March 2026):**

Initial user testing with two participants (standard invite flow, QR-based) revealed several pain points. Neither tester completed the full flow to reaching peakd.com.

| Step | Tester A | Tester B |
|---|---|---|
| Scanned QR successfully | No | Yes |
| Invite validated | Yes | Yes |
| Reached key saving screen | Yes | Yes |
| Saved screenshot | Yes | No |
| Account created | Yes | No |
| Proceeded to HiveSigner | Yes | No |
| Logged in with HiveSigner | No | No |
| Reached peakd.com | No | No |

Key pain points identified:
- **QR scanning unreliable:** Tester A's phone camera failed to scan the QR code initially, requiring a workaround. QR codes must be tested across a range of devices and camera apps.
- **Key backup screenshot not taken:** Tester B did not save the screenshot at the key backup step and could not proceed to account creation. The screenshot step needs to be more prominent or enforced — the current emphasis (commit `014df33`) may help but was not yet deployed during this test. Tester B was using an older version without the emphasis. Options to further increase emphasis: (a) flashing "Important" text animation (red/yellow pulse), (b) pulsing border/glow on the banner, (c) one-time entrance animation (shake/slide), (d) blocking confirmation — require user to check "I've taken a screenshot" before proceeding. Option (d) is most effective but adds friction; could combine with (a) or (b).
- **Account creation slow / failed:** Account creation was consistently slow for all testers who reached that step. Investigation shows two compounding causes: (1) the giftcard service on Fly.io is configured with `min_machines_running: 0` and `auto_stop_machines: 'stop'`, meaning cold starts of 10-30+ seconds before the service can even process a request; (2) the on-chain `create_claimed_account` transaction adds 3-10 seconds on top. ~~The wallet has no timeout, no retry logic, and no pre-flight wake-up call — the `/health` endpoint exists on the service but is never used by the client. A warm-up ping earlier in the flow (e.g. during username selection or validation) would mask cold-start latency.~~ ✅ **Partially addressed** — the warm-up ping has been moved to the PIN entry screen, giving the service several screens of warm-up time before the `/claim` request. Timeout handling with a retry button has been added to the claiming screen (60-second timeout). Estimated wait time UX is not yet implemented.
- ~~**HiveSigner handoff incomplete:** Tester A created an account and proceeded to HiveSigner but did not complete login. The multi-step handoff (copy username, copy key, navigate to HiveSigner, paste credentials) is too many steps for a first-time user with no blockchain experience.~~ ✅ **Fixed** — replaced HiveSigner with PeakLock direct login. The invite app now opens `peakd.com/signin?mode=peaklock&account=<username>&r=/trending`, auto-copies the posting key to clipboard, and the user only needs to paste their key and set a 5-digit PIN (~2 user actions). Implemented after @asgarth added query-string login support to peakd.com (March 2026).
- **Overall flow too clunky:** The end-to-end process has too many discrete steps requiring user action. Each step is a drop-off point. The flow should be streamlined to minimise the number of user decisions and manual actions between scanning the QR and reaching a usable Hive experience.

**Additional UX improvements (standard invite flow):**

- ~~**Step progress indicator:** Users have no sense of where they are in the flow or how many steps remain. A simple step counter or progress bar (e.g. "Step 2 of 5") at the top of each screen would set expectations and reduce abandonment. The flow has 5 user-facing stages: PIN → Verifying → Username → Backup → Claiming/Success.~~ ✅ **Done** — step progress bar implemented.
- ~~**Auto-copy posting key on HiveSigner redirect:** Copy buttons are implemented for both username and posting key on the success screen, with visual "Copied" feedback. However, the posting key is not auto-copied when the HiveSigner tab opens — the user must click the copy button separately before clicking the HiveSigner link. Auto-copy on redirect would further reduce friction.~~ ✅ **Done** — posting key is auto-copied to clipboard when the user clicks the PeakLock login button.
- **Estimated wait time on claiming/verifying screens:** Not yet implemented. The claiming screen shows "Connecting..." / "Claiming account..." with a spinner but no time estimate. Adding "This usually takes 10–20 seconds" would reduce perceived abandonment.
- ~~**Timeout with actionable message:** Neither the verifying nor claiming screen has visible timeout handling. After ~30 seconds, show an actionable message: "This is taking longer than usual — your gift card is still valid. You can retry or try again later." rather than spinning indefinitely.~~ ✅ **Partially done** — the claiming screen detects a 60-second timeout and shows a retry button with guidance. The verifying screen has error handling with retry but no explicit timeout.
- ~~**Service warm-up at PIN entry:** The `/health` warm-up ping currently fires on the verifying screen. Moving it to the PIN entry screen gives Fly.io 2–3 additional screens of warm-up time (PIN entry + verifying + username selection) before the `/claim` request, further masking cold-start latency.~~ ✅ **Done** — warm-up ping moved to PIN entry screen.
- **Confirmation summary before claiming:** Not yet implemented. The flow advances directly from key backup to claiming with no confirmation step. A brief "You're about to create account **@username** on the Hive blockchain" confirmation would catch typos.
- ~~**Username suggestions on collision:** When a chosen username is taken, suggest available variations (e.g. appending digits or hyphens). First-time users unfamiliar with Hive naming conventions may get stuck in trial-and-error.~~ ✅ **Done** — `generateSuggestions()` provides up to 4 available alternatives as clickable chips when a username is taken.
- **Back navigation:** Not yet implemented. The flow is strictly linear with no way to return to a previous screen.
- **Claiming idempotency guidance:** The gift card service rejects duplicate claims with "Token already redeemed" (400 error) rather than returning success for the same token+username. True idempotent retries (returning success if the same token+username was already fulfilled) would improve the timeout-then-retry experience. The UI does not yet guide the user to try logging in directly if the claim may have succeeded silently.
- **Mobile credential font sizes:** Not yet addressed. The posting key on the success screen is displayed at `.7rem`.
- **PIN input visual segments:** Not yet implemented. Uses a plain `<input type="text">` with letter-spacing. Filled dots or discrete character slots (similar to a phone unlock screen) would make the 6-character target visually clear.
- **Offline detection:** Not yet implemented. No `navigator.onLine` checks before network-dependent screens.
- **Invite app i18n:** Not yet implemented. The invite app is English-only despite the wallet supporting 7 locales. This is a larger effort but important for the target audience in China, Iran, Russia, Turkey, and Vietnam.

### 2.5 Onboarding Service (General)

The gift card system (section 2.4) is the primary onboarding mechanism. This section describes the general onboarding service capabilities that support gift card onboarding and may also support other onboarding channels in the future (e.g. web-based signup, Telegram bot, invite system).

The onboarding service:
- Is reachable through channels that are accessible in restricted regions (e.g. CDN-fronted website, Telegram bot, or in-person via gift cards)
- Provisions new Hive accounts using account creation tokens, falling back to burning HIVE via `account_create` if no tokens are available (see "Account Creation Fallback" below)
- Delegates initial HP to new accounts so they have sufficient Resource Credits to transact
- Enrolls new users in the endpoint subscription feed via transfer memo to the feed service account
- For the proof-of-concept phase, payments are ad hoc or free — the focus is on validating the technical flow

### 2.6 Invite System

Existing users can onboard new users, enabling organic growth without centralized bottlenecks. This is a supplementary mechanism alongside gift card onboarding (section 2.4).

- Existing users can create Hive accounts for new users using Hive's native account creation tokens
- The inviting user can enroll the new user in the endpoint subscription feed by sending a transfer to the service account with the new username in the memo
- This creates social accountability — if an invitee leaks endpoint information, the invite chain is traceable
- Invite capacity may be limited (e.g. N invites per user per period) to control growth rate and limit blast radius of compromised users
- Existing Hive systems for account creation and invites have not driven significant growth on their own; the invite system here complements gift card onboarding rather than replacing it

### 2.7 Onboarding Fee & Subscription Model

The service requires payment to cover infrastructure costs. For the proof-of-concept phase, onboarding is free or ad hoc — the priority is validating the technical flow. The payment model below applies to production operation.

- **Onboarding fee (one-time)**: Covers Hive account creation, initial HP delegation, and setup. For gift card onboarding, this fee is paid by the gift card provider when generating a batch (effectively the cost of account creation tokens + infrastructure). End users do not pay at redemption time.
- **Endpoint subscription (recurring)**: Covers ongoing provision of personal RPC endpoints and proxy infrastructure. Payable in HBD via on-chain transfer to the service account.
- **Self-sustaining from interest**: A user staking HBD in savings earns ~20% APR. Even modest stakes generate enough interest to cover subscription fees. For example, 100 HBD earns ~20 HBD/year — the subscription should be priced well below this to ensure the service is a clear net positive for users.
- **Grace periods**: New users should receive an initial service period included in the onboarding fee, giving them time to acquire and stake HBD before the first subscription payment is due.
- **Gift card provider economics**: Hive whales with substantial account creation tokens can run independent gift card services, selling cards at a modest markup over their costs (account tokens + HP delegation + infrastructure). This provides a return on Hive Power and distributes the operational burden across multiple independent providers.

### 2.8 Modified Hive Keychain

A fork of the [Hive Keychain browser extension](https://github.com/hive-keychain/hive-keychain-extension) (MIT licensed) that integrates the same RPC endpoint discovery and traffic obfuscation capabilities as the self-contained wallet tool. The primary goal is wallet functionality and dApp browsing while retaining the extension's existing security model.

**Purpose:** Existing Hive users who already use Hive Keychain can install this modified version *before* traveling to a region with restricted internet access, giving them continued access to Hive through a familiar interface.

**Scope — priority features:**
- Core wallet functionality (balances, transfers, staking, savings, delegations, account history)
- dApp browser integration (the injected `window.hive_keychain` API for sites like Peakd)
- Transaction signing and broadcasting

**Scope — lower priority / deferred:**
- Hive Engine sidechain token support (requires proxying a separate set of RPC nodes)
- Swap service integration (depends on the Keychain backend API)
- PeakD push notifications (depends on the Keychain backend API)
- Ledger hardware wallet support (works locally, no proxy impact, but adds testing surface)

#### Architecture — why Keychain is a good fit for this

Hive Keychain centralises all Hive RPC communication through the [`hive-tx-js`](https://github.com/hive-keychain/hive-tx-js) library (also MIT licensed, maintained by the same org). Every RPC call in Keychain flows through a single function — `hiveTx.call(method, params)` — which sends JSON-RPC requests to whichever node is configured in `HiveTxConfig.node`. This means there is essentially **one integration point** for adding obfuscation and proxy support.

Individual operation handlers (transfer, delegation, vote, etc.) call utility classes which internally use `hive-tx`. The operation handlers themselves make no direct HTTP calls.

#### Implementation approach

**1. Fork `hive-tx-js` with obfuscation support**

Add an optional obfuscated transport mode to the `hive-tx` `call()` function, reusing the same protocol as the Propolis wallet (section 2.2):

- When obfuscation is enabled: gzip-compress the JSON-RPC payload, base64-encode it, wrap in a REST-like envelope (`{"q": "<base64>", "sid": "<random>"}`), POST to a random innocuous path (`/api/comments`, `/api/feed`, etc.) with `X-Api-Version: 1` header
- Decode the response by extracting the `data.r` field and reversing the encoding
- When obfuscation is disabled: standard JSON-RPC over HTTPS (existing behaviour, unchanged)
- The obfuscation toggle is controlled by a flag passed from the extension's settings, not hardcoded

This is cleaner than intercepting at the fetch level (as the Propolis wallet does) because extensions run in a service worker context where global fetch interception is more complex.

**2. Expand the proxy method allowlist**

The current HAA proxy (section 2.2) allows only 7 methods — the minimum for the Propolis wallet. Keychain's wallet and browser functionality requires substantially more. The proxy allowlist must be expanded to include at minimum:

*Wallet operations (required):*
- All 7 existing methods (`condenser_api.get_accounts`, `get_dynamic_global_properties`, `broadcast_transaction`, `broadcast_transaction_synchronous`, `get_account_history`, `get_block`, `transaction_status_api.find_transaction`)
- `condenser_api.get_vesting_delegations` — delegation queries
- `condenser_api.get_open_orders` — market orders
- `condenser_api.get_witnesses_by_vote` — witness voting
- `condenser_api.get_conversion_requests` — HBD conversions
- `condenser_api.get_savings_withdraw_from` / `get_savings_withdraw_to` — savings operations
- `rc_api.find_rc_accounts` — resource credit checks

*Browser / dApp support (required for Peakd etc.):*
- `bridge.get_account_posts` — user post feeds
- `bridge.get_ranked_posts` — trending/hot/new feeds
- `bridge.get_discussion` — post + comment threads
- `bridge.get_community` / `bridge.list_communities` — community browsing
- `bridge.get_profile` — user profiles
- `bridge.get_follow_count` — social graph
- `condenser_api.get_content` — individual post lookup
- `condenser_api.get_content_replies` — comment threads

*Hive Engine sidechain (deferred, separate proxy):*
- Hive Engine tokens use entirely different RPC endpoints (`api.hive-engine.com`). Supporting tokens would require either a separate proxy instance or extending the existing proxy to relay to multiple upstream backends. This can be deferred to a follow-up phase.

The proxy should continue using an **allowlist** (not a blocklist) approach — explicitly enumerating permitted methods is safer than trying to block dangerous ones.

**3. Endpoint discovery**

Keychain currently fetches its default RPC node from `api.hive-keychain.com/hive/rpc` on startup. In restricted regions, this backend is likely also blocked. The fork needs a hybrid discovery approach:

- **Hardcoded bootstrap list**: Ship a set of known proxy URLs in the extension, updated with each release. This provides immediate connectivity without depending on any external service.
- **Memo-based discovery**: Once connected (via bootstrap or any reachable node), use the same `haa-service` encrypted memo mechanism as the Propolis wallet (section 2.1) to discover current proxy endpoints. This keeps the endpoint list fresh without requiring extension updates.
- **Manual configuration**: Retain the ability for users to manually specify a proxy endpoint URL in settings (for users who operate their own proxy).

The bootstrap list solves the chicken-and-egg problem: you need a proxy to read Hive, but you discover proxies by reading Hive.

**4. Remove or stub the Keychain backend dependency**

Hive Keychain makes non-RPC calls to its own backend (`api.hive-keychain.com`) for:
- Default RPC node recommendation → replaced by the discovery mechanism above
- Swap service → deferred (strip from initial fork)
- PeakD notification relay → deferred (strip from initial fork)
- Socket.io realtime updates → deferred (strip from initial fork)

The fork should gracefully degrade when these services are unreachable — no errors shown to the user, features simply hidden.

**5. RPC failover adaptation**

Keychain has existing node failover logic (`rpc-switcher.utils.ts`) that rotates through known RPC nodes when one fails. This must be adapted to:
- Prioritise discovered proxy endpoints (from memo discovery) over hardcoded bootstrap endpoints
- Exclude public Hive API nodes from the candidate set when obfuscation is enabled (same logic as the Propolis wallet's `rpc-manager.ts`)
- Test endpoint health using obfuscated requests when in obfuscated mode

#### Security model

The fork **retains Keychain's existing security architecture** with no degradation:

- **Key storage**: Unchanged — private keys encrypted with AES (via `crypto-js`) using the user's master password. Encrypted data stored in `chrome.storage.local`. Master password held in-memory only (service worker vault), never persisted.
- **Transaction signing**: Unchanged — all signing happens locally in the service worker. Only signed transactions leave the device. The proxy never sees private keys.
- **dApp isolation**: Unchanged — the content script injects `window.hive_keychain` but never exposes keys. Operation requests open a confirmation dialog; the user explicitly approves each transaction.
- **Auto-lock**: Unchanged — vault clears on idle/browser shutdown.

**Proxy trust model:** The proxy can observe *which* accounts are being queried and *what* signed transactions are being broadcast (the same information visible to any public Hive API node). It cannot forge transactions because it does not have the user's private keys. However:

- A malicious proxy could **selectively censor** transactions (refuse to broadcast) — mitigated by failover to alternative proxies
- A malicious proxy could **return falsified read data** (wrong balances, missing history) — mitigated by cross-verifying critical reads against multiple endpoints when possible
- The obfuscation layer resists deep packet inspection but is **not encryption** — a determined adversary who controls the proxy and knows the protocol can decode the traffic. HTTPS/TLS provides the actual confidentiality layer. Users should understand that obfuscation protects against network-level DPI, not against a compromised proxy operator.

#### Limitations

- This is **not a solution for users inside restricted regions who lack prior access.** Browser extension stores (Chrome Web Store, Firefox Add-ons) may themselves be blocked or restricted. The modified Keychain cannot be installed from within a restricted environment.
- It is intended for users who **already have Hive accounts and Keychain installed**, and who want to maintain access when traveling to or residing in restricted areas.
- Distribution of this extension is through conventional channels (extension stores, sideloading from a trusted source). It does not need on-chain distribution — users install it while they still have unrestricted access.
- Sideloading on Chromium requires developer mode; Firefox supports unsigned add-ons only in Developer/Nightly editions. For broad distribution, publishing to extension stores under a separate listing is preferred.

#### Relationship to the wallet tool

- The wallet tool (section 1.1) is for users who cannot install extensions — it works as a standalone HTML file with no installation
- The modified Keychain is for users who *can* install extensions ahead of time and prefer the richer Keychain experience
- Both share the same endpoint discovery protocol and obfuscation layer, ensuring compatibility with the same proxy infrastructure
- The proxy method allowlist expansion benefits both: the wallet tool could optionally surface more features if the proxy supports the additional methods

### 2.9 Multi-Tenant Onboarder Dashboard

A self-service dashboard on HiveInvite.com that enables independent Hive users to become gift card issuers — generating, managing, and distributing gift cards under their own authority, using the shared gift card service infrastructure.

**Terminology:**

| Role | Description |
|------|-------------|
| **Operator** | Runs the gift card service, distribution bots, and proxy infrastructure. Reviews and approves issuer applications. Integrates custom design templates. |
| **Issuer** | A Hive user approved to create gift cards. Funds their own account creation tokens. Redemptions happen under their authority (their account's active key, delegated to the service). Manages their own batches and distributors. |
| **Distributor** | A user authorized by an issuer to share gift cards via distribution channels (Telegram bot, Discord bot, etc.). Cannot create cards — only distributes cards from the issuer's pool. |

These terms replace the earlier "provider" terminology used in section 2.4. In the existing codebase and on-chain declarations, "provider" maps to "issuer" in this model.

#### 2.9.1 Issuer Application and Approval

Any Hive user can apply to become an issuer. Approval is a manual decision by the operator.

**Application (on-chain):**

The applicant broadcasts a `custom_json` transaction signed with their **active key**:

```json
{
  "id": "propolis_issuer_apply",
  "json": {
    "service": "<operator-service-account>",
    "description": "Brief description of community/use case",
    "contact": "Optional contact method (Telegram, Discord, etc.)"
  }
}
```

The active key signature proves the applicant controls the account. The `service` field identifies which operator's service they're applying to (supports future multi-operator scenarios). The application is a public, auditable record — anyone can see who applied.

**Approval (on-chain):**

The operator broadcasts a `custom_json` from the service account:

```json
{
  "id": "propolis_issuer_approve",
  "json": {
    "issuer": "<applicant-username>",
    "approved_at": "<ISO 8601 timestamp>"
  }
}
```

**Rejection:** No on-chain record is broadcast. Silence = not approved. The operator may optionally contact the applicant off-chain to explain, but the system does not require or record rejections. This avoids creating a permanent public record of denied applications.

**Operator notification:**

The gift card service watches for `propolis_issuer_apply` custom_json operations targeting its service account. When a new application is detected:
- The operator receives a Telegram notification (via the existing bot infrastructure) with the applicant's username, description, and a link to review their Hive profile
- The dashboard includes an admin view listing pending applications

Both notification channels ensure the operator is aware of new applications promptly.

#### 2.9.2 Issuer Onboarding Flow

After approval, the issuer must complete setup before they can generate cards:

**Step 1 — Notification.**
The operator's approval `custom_json` triggers a Hive transfer (e.g. 0.001 HBD) from the service account to the issuer with an encrypted memo containing:
- Confirmation of approval
- A link to the dashboard setup page on HiveInvite.com
- Instructions for the next step (active authority delegation)

**Step 2 — Active authority delegation.**
The issuer must add the service account's public active key to their account's active authority list (via `update_account`). This grants the service the ability to sign transactions on the issuer's behalf (specifically `create_claimed_account` and `delegate_vesting_shares`).

The dashboard guides the issuer through this:
- Displays the exact authority change needed
- Provides a Hive Keychain signing prompt to execute the `update_account` operation directly from the dashboard
- Verifies the delegation was successful by checking the issuer's account authorities on-chain
- Clearly communicates the trust implications (same warnings as section 2.4's "Trust and security considerations for delegating providers")

**Step 3 — Account creation tokens.**
The issuer is responsible for having sufficient account creation tokens (claimed via Resource Credits from their Hive Power) or liquid HIVE (for the paid fallback). The dashboard displays:
- Current `pending_claimed_accounts` count
- Estimated account creation cost if tokens are exhausted
- Guidance on claiming more tokens (link to relevant Hive documentation or tooling)

**Step 4 — Ready.**
Once active authority is delegated and verified, the issuer can access the full dashboard and generate their first batch.

#### 2.9.3 Dashboard (HiveInvite.com)

The dashboard is a static site hosted on HiveInvite.com (GitHub Pages), making API calls to the gift card service on Fly.io. Authentication is via **Hive Keychain** — the dashboard presents a challenge, the issuer signs it with their posting key via Keychain, and the service verifies the signature.

**Public pages (unauthenticated):**
- Landing page — explains the gift card system, how it works, benefits of becoming an onboarder
- "Become an Onboarder" — application form that triggers the `propolis_issuer_apply` custom_json via Keychain

**Issuer dashboard (Keychain-authenticated):**

- **Overview** — account creation tokens remaining, total cards issued, total cards claimed, active batches
- **Generate batch** — single form:
  - Count (number of cards)
  - Design (default with issuer username, or issuer's approved custom design if available)
  - Locale (en, zh, ar, fa, ru, tr, vi)
  - Expiry (days until expiration, default: 365)
  - Distribute (toggle: automatically push tokens to distribution bots after generation)
- **Batch history** — list of all batches with status summary (total, claimed, expired, remaining)
- **Batch detail** — per-card status, download manifest, download PDFs (individual or combined), retroactive push to distribution bots
- **Distributors** — manage authorized distributors (see section 2.9.5)
- **Design** — preview the default design with their username; submit custom design assets for operator review (see section 2.9.6)
- **Setup** — authority delegation status, account creation token balance, issuer profile

**Operator admin view (operator Keychain-authenticated):**
- Pending issuer applications (approve/ignore)
- Active issuers list with summary stats
- Pending custom design submissions
- System health overview

#### 2.9.4 Batch Generation via Dashboard

When an issuer requests a new batch through the dashboard:

1. Dashboard sends an authenticated request to the gift card service: count, locale, design, expiry, distribute flag
2. The gift card service generates the batch entirely server-side (same pipeline as the existing `giftcard-generate.ts` script):
   - Generates tokens and PINs
   - Builds Merkle tree
   - Stores tokens in SQLite
   - Broadcasts batch declaration `custom_json` on-chain (signed by the service account using delegated authority from the issuer)
   - Generates QR codes and PDFs using the specified design
3. Service returns the batch ID and download URLs to the dashboard
4. Issuer downloads the combined PDF and/or manifest from the dashboard
5. If the "distribute" flag was set, the service pushes tokens to connected distribution bots (see section 2.9.5)

The issuer can also download the full manifest (containing tokens, PINs, and invite URLs) for their records. The manifest is sensitive — the dashboard displays a clear warning that it contains all card secrets.

**Issuer responsibility notice:**
The dashboard displays a persistent notice that the issuer is responsible for:
- Maintaining sufficient account creation tokens or HIVE balance to cover redemptions for all active (unredeemed, unexpired) cards
- Managing the volume of cards they generate — generating more cards than they can fund creates a poor experience for recipients whose cards fail to redeem
- The operator does not guarantee redemption if the issuer's account lacks tokens or funds

#### 2.9.5 Distributors

An issuer can authorize other Hive users to distribute their gift cards via bots. Distributors cannot generate cards — they can only share cards from the issuer's pool through connected distribution channels.

**Authorization (on-chain):**

The issuer broadcasts a `custom_json` signed with their posting key:

```json
{
  "id": "propolis_distributor_authorize",
  "json": {
    "distributor": "<hive-username>",
    "platforms": {
      "telegram": "<telegram-user-id>",
      "discord": "<discord-user-id>"
    }
  }
}
```

Revocation uses the same structure with `"propolis_distributor_revoke"` as the ID.

**Platform identity mapping:**
Distributors need their Telegram and/or Discord accounts mapped to their Hive username so that distribution bots can verify authorization. The `platforms` field in the authorization `custom_json` provides this mapping. The issuer is responsible for verifying the distributor's platform identities before broadcasting the authorization.

**Bot integration:**
- Distribution bots (Telegram, Discord) read distributor authorizations from the chain (cached, refreshed periodically)
- When a distributor issues a command (e.g. `/invite issuername`), the bot verifies the distributor is authorized by that issuer
- If the distributor is authorized by exactly one issuer, the issuer argument can be omitted (default issuer mode): `/invite` is equivalent to `/invite <their-sole-issuer>`
- The bot dispenses a card from the issuer's pool and sends it to the recipient

**Token distribution to bots:**
When a batch is created with the "distribute" flag, or when an issuer retroactively pushes a batch from the dashboard, the gift card service sends the card tokens to the connected distribution bots via an internal REST callback. The bot stores these in its local inventory, associated with the issuer.

The Telegram and Discord bot commands need to be updated to accept a Hive username argument for the issuer:
- Telegram: `/invite [issuer]` — dispense a card from the specified (or default) issuer's pool
- Discord: `/invite [issuer]` — same behaviour via slash command

#### 2.9.6 Gift Card Designs

**Default design (v1):**
Every issuer has access to the default Hive Community design. When used by an issuer, their Hive username is automatically inserted as the issuer line on the card front (e.g. "Issued by @username"). No additional configuration needed.

The dashboard provides a live preview of the default design with the issuer's username before batch generation.

**Custom designs (future phase):**
Custom designs are not self-service — they require operator involvement for quality control and security review (preventing malicious content in uploaded assets).

The workflow:
1. Issuer submits design assets via the dashboard: logo image, color preferences, optional background image, any text overrides
2. The operator receives a notification of the new design submission
3. The operator reviews the assets, builds a proper `DesignConfig` template following the existing design system (see `scripts/designs/types.ts`), tests the output, and deploys it to the service
4. The new design appears in the issuer's design dropdown on the dashboard

Custom design support is **deferred from v1**. The initial release supports only the default design with issuer username.

#### 2.9.7 On-Chain Data Model

All role relationships and authorizations are stored on-chain via `custom_json` operations, providing transparency and auditability.

| Operation ID | Signed by | Purpose |
|---|---|---|
| `propolis_issuer_apply` | Applicant (active key) | Request to become an issuer |
| `propolis_issuer_approve` | Operator (service account) | Approve an issuer application |
| `propolis_distributor_authorize` | Issuer (posting key) | Authorize a distributor + platform mapping |
| `propolis_distributor_revoke` | Issuer (posting key) | Revoke a distributor's authorization |
| `propolis_giftcard_batch` | Service account (delegated from issuer) | Batch declaration (existing, unchanged) |

The gift card service scans for these operations and caches the results to build its view of the issuer/distributor relationships. The on-chain record is the source of truth — the service's cache is reconstructible from chain history at any time.

#### 2.9.8 Implementation Priorities

The dashboard is delivered incrementally:

**v1 — Core dashboard:**
- Issuer application and approval flow (on-chain custom_json)
- Dashboard with Keychain authentication
- Batch generation via dashboard (server-side, full pipeline)
- Default design with issuer username auto-filled
- Batch history and card status
- Operator notification of new applications (Telegram + dashboard admin view)
- Issuer responsibility notice

**v2 — Distribution integration:**
- Distributor authorization (on-chain custom_json with platform mapping)
- Automatic batch push to Telegram/Discord bots
- Default issuer mode for distributors
- Bot command updates to accept issuer argument

**v3 — Design and polish:**
- Custom design submission and operator review workflow
- Design preview in dashboard
- Issuer profile and public stats

---

## Security Considerations

- **Private keys never leave the client device.** All transaction signing happens locally.
- **The wallet tool's integrity is verifiable** via on-chain checksums and hash manifests.
- **Bootstrap code injection is prevented** by three layers: only comments from the publisher account are processed, every chunk is verified against a SHA-256 hash manifest before any code executes, and verification aborts entirely on any mismatch. No on-chain content runs until the full manifest is validated.
- **Proxy nodes are untrusted relays.** They see signed transactions (which are public anyway once broadcast) and return public blockchain data. They cannot modify, forge, or withhold transactions without detection.
- **Per-user endpoint feeds prevent single-point compromise.** No individual user can leak information that affects other users' access.
- **Leak tracing is built in.** Endpoint-to-user-group mapping allows identification of compromised users when endpoints are blocked.
- **Users must understand the 3-day unstaking delay** for HBD savings — this is a blockchain-level property, not a limitation of the tool.
- **Invite chains create accountability.** Users who invite others are implicitly vouching for them, creating a social trust layer.
- **Gift card QR codes are PIN-encrypted.** The QR alone reveals only a public invite app URL — proxy endpoints, claim tokens, and provider information are encrypted with a 6-character alphanumeric PIN. This prevents proxy infrastructure from being discovered through bulk QR scanning.
- **Gift card authenticity is cryptographically verifiable.** Each card carries a digital signature from the provider's memo key. The invite app verifies this against the on-chain public key before proceeding, preventing counterfeit cards.
- **Gift card batches are declared on-chain.** Batch declarations with Merkle root commitments provide a transparent audit trail of token issuance and enable verification that individual tokens belong to a declared batch.
- **Gift card claim tokens are single-use and expire.** A stolen token lets an attacker claim an empty account, but does not compromise any existing user. Keys are generated locally on the user's device, never embedded in the QR or transmitted. Expired tokens cannot be redeemed.
- **Gift card services are security-isolated from proxies.** The gift card service holds account creation keys; the proxy holds no such keys. Compromise of a proxy does not grant account creation capability.
- **Gift card service account alerting.** The gift card provider account's active key is held persistently by the claim service (required for autonomous account creation). To mitigate the risk of key compromise, the provider should be alerted immediately when any unexpected operation is broadcast from the account — i.e. any operation other than `create_claimed_account`, `delegate_vesting_shares`, or small HBD transfers to the feed service account. On alert, the provider can revoke the active key via a wallet that holds the owner key (e.g. Peakd with Hive Keychain). Existing Hive ecosystem monitoring tools should be evaluated before building a custom solution.
- **User communication security.** Users in restricted regions (particularly mainland China) may instinctively share gift card details, PINs, or screenshots on familiar but surveilled platforms (e.g. WeChat, QQ). This risks exposing the user, the card contents, and potentially the proxy infrastructure. User-facing materials use normalised, non-alarming language ("this card is personal — don't share the PIN") and provide a secure support channel (Signal) as the obvious help path. Explicit platform-risk guidance is reserved for distributors only — warning end users against specific platforms like WeChat risks scaring them off the invite entirely (see "Secure support channel" under section 2.4).

## Operational Model

### Design Principle: Operational Decentralisation

The protocol and tooling must be designed so that **no single operator is required** for the system to function. Any sufficiently motivated party should be able to run a compatible service instance independently.

This means:
- The wallet tool is open source and works with any compatible service provider
- The on-chain signaling protocol (encrypted memos with endpoint information) is documented and standardised
- Multiple independent operators can coexist, each managing their own subscriber base and proxy infrastructure
- Users can switch between service providers by simply subscribing to a different operator's feed
- The RPC proxy protocol is open, so anyone can stand up proxy nodes
- Any Hive account with account creation tokens can independently run a gift card service, registering their service URL on-chain for wallet discovery

### Why This Matters

Operational decentralisation serves three purposes:

1. **Resilience.** If one operator is shut down or stops operating, users can migrate to another provider. The wallet tool and their Hive account remain fully functional.
2. **Risk distribution.** No single person or entity bears the full legal and operational risk of running the service globally. Different operators may serve different regions, accept different risk profiles, and operate under different jurisdictions.
3. **Credibility separation.** The protocol designer and initial proof-of-concept builder does not need to be the long-term operator. The architecture, wallet tool, and documentation can be published by a known, trusted community member — establishing credibility and trust in the *system* — while ongoing service operation can be handled by independent parties, including pseudonymous ones.

### Proof of Concept Phase

The initial proof of concept will be built and tested by the project founder, including testing in restricted environments. This phase:
- Validates the technical approach (wallet tool, proxy relay, encrypted endpoint feed, traffic obfuscation)
- Does not involve financial payments or money transmission — test accounts and test HBD only
- Does carry inherent risk from being perceived as developing censorship circumvention tooling, which the founder accepts
- Produces open-source tooling and documented protocols that others can adopt independently

### Operational Phases

| Phase | Operator model | Risk profile |
|---|---|---|
| Phase 1 (wallet tool) | Open source, no operator needed | No infrastructure; no payments; minimal risk — the wallet is a standard Hive tool |
| Phase 2 (restricted access) | Founder or trusted community members | Proxy infrastructure required; onboarding fees begin; censorship circumvention risk |
| Phase 3 (on/off ramp) | Independent operators (may be pseudonymous) | Decentralised; legal complexity of fiat conversion |

The architecture must support all phases without structural changes. The transition from founder-operated to community-operated should require no changes to the wallet tool or user experience — only a change in which account sends the encrypted endpoint memos.

---

## Non-Functional Requirements

- **No server dependency for core operations.** The wallet tool must function with any working RPC endpoint — it has no "home server."
- **Minimal trust assumptions.** Users trust only the Hive blockchain itself and their own key management. Everything else (proxies, signaling feed, distribution) is verifiable or replaceable.
- **Graceful degradation.** If the endpoint feed is unavailable, users can manually enter a known RPC endpoint. If proxies are blocked, users can fall back to a VPN. The tool should always remain functional given *any* working RPC connection.
- **Subscription pricing must leave clear margin.** The subscription fee should be a small fraction of HBD savings interest, ensuring the service is obviously worthwhile to users.

## Browser Targets

**Phase 1 (Propolis Wallet):** Chrome, Firefox, Safari — desktop and mobile. These cover the vast majority of Hive community users. The wallet uses standard Web APIs (`fetch`, `crypto.subtle`, `localStorage`) and targets ES2022, all well-supported across these browsers.

**Phase 2 (Restricted access):** Adds testing and support for browsers common in target restricted regions, particularly:
- WeChat in-app browser (Chromium-based, significant quirks)
- QQ Browser, UC Browser, Baidu Browser (major market share in China)
- Safari on iOS (iPhones are widely used in China)

Phase 2 browser testing is deferred until the proxy infrastructure exists to actually serve users in those regions.

---

## Future Considerations

### Customizable Post-Claim Onboarding Flows

The invite app currently sends all newly onboarded users to PeakD (standard invites) or the Propolis wallet (robust invites). Hive service providers — games, video platforms, finance apps — would benefit from directing new users into their own application instead.

**Goal:** Allow invite providers to select from a set of hardcoded destination options built into the invite app, without forking. The provider specifies which destination at batch generation time, and the invite app handles the appropriate handoff after account creation.

**Hardcoded destinations** (initial set, expanded over time):
- PeakD (current default for standard invites)
- Propolis wallet (current default for robust invites)
- 3Speak
- Splinterlands
- LeoFinance
- Ecency

Each destination includes its own branded success screen, relevant instructions, and the appropriate key handoff mechanism (e.g. HiveSigner, PeakLock, or Hive Keychain prompt).

**Design considerations:**

- **Configuration source:** The destination is embedded in the invite payload at batch generation time. Different batches from the same provider can target different apps.
- **Backwards compatibility:** Invites generated before this feature exists must continue to work. The invite app falls back to the current default flow when no destination is specified in the payload.
- **Adding new destinations:** New options require a code change to the invite app. Service providers who want to be included can request addition to the hardcoded list. This keeps the app simple and avoids open-redirect risks.

**Implementation scope:** Future consideration. Today, providers who want custom onboarding flows can fork the invite app.

### Optional Email Collection During Onboarding

The invite app should support a lightweight mechanism for collecting user contact details to enable follow-up communication. To avoid adding friction to the onboarding flow, this should be presented **during the account creation wait** — while the spinner is displayed and the user is already waiting for the on-chain operation to complete. This is otherwise idle time from the user's perspective, making it a natural moment to ask.

The prompt should:
- Ask for an email address (and/or other contact method)
- Make it **explicitly clear that this is optional** — the user can dismiss or ignore it without any impact on account creation
- Explain briefly why it's useful (e.g. "so we can send you tips on getting started with Hive")
- Not block or delay the account creation flow in any way

**Data protection considerations:** Collecting and storing email addresses introduces obligations under GDPR, CCPA, and other data protection regulations. Before implementing this feature, the following must be addressed:
- Legal basis for processing (likely legitimate interest or consent)
- What data is stored, where, and for how long
- User rights (access, deletion, portability)
- Privacy policy and disclosure requirements
- Whether the gift card service operator (who may vary) is the data controller
- Cross-border data transfer implications, given the target user base spans multiple jurisdictions
- Minimisation — collect only what is needed and retain only as long as necessary

### Active User Follow-Up and Key Migration

For users who actually become active on-chain after onboarding, the system should provide a follow-up pathway that helps them:

1. **Migrate their keys into Hive Keychain** — the invite app's initial handoff (via HiveSigner or PeakLock) gets the user active quickly, but these are not the ideal long-term key management solutions. Active users should be guided toward installing Hive Keychain (mobile app or browser extension), which provides non-custodial key storage, multi-app support, and better security. The follow-up should include clear, step-by-step instructions appropriate for users who may have no prior blockchain or extension-management experience.

2. **Understand the importance of backing up account keys** — new users often do not appreciate that Hive keys cannot be recovered if lost (there is no "forgot password" flow). The follow-up should clearly explain the risk, guide the user through securely backing up their owner key and master password, and emphasise that losing these keys means permanent loss of account access.

**Detection of active users:** Activity can be detected on-chain by monitoring for transactions from accounts created through the gift card system (the gift card service already knows which accounts it created). Relevant signals include posting, voting, transfers, or staking operations. This monitoring can be done passively via account history lookups — no cooperation from the user is required.

**Follow-up delivery mechanisms** (to be evaluated):
- On-chain memo transfers (as already planned for Stage 2 follow-up — small HBD transfer with a memo linking to setup instructions)
- Email (if collected during onboarding — see above)
- In-app prompts if the user returns to the invite app or wallet

The follow-up should be non-intrusive and timed appropriately — e.g. after the user has made a few posts or transactions, rather than immediately after account creation.

### Gift Card Purchases via Transfer

Allow users to purchase gift cards by transferring Hive or HBD to the gift card provider account. The gift card service monitors the provider account for incoming transfers, generates a gift card, and emails it to the recipient address specified in the memo.

This relies on the account creation fallback described below.

### Account Creation Fallback

The gift card service normally creates accounts by consuming pre-claimed account creation tokens via `create_claimed_account`. If no tokens are available (i.e. the provider's `pending_claimed_accounts` count is zero), the service should fall back to creating the account by burning HIVE via the `account_create` operation, which requires paying the current account creation fee (queried from chain properties).

**Behaviour:**
- On each account creation request, check the provider account's `pending_claimed_accounts` count
- If tokens are available, use `create_claimed_account` (no HIVE cost beyond RC)
- If no tokens are available, use `account_create`, paying the on-chain account creation fee from the provider account's liquid HIVE balance
- If the provider also has insufficient liquid HIVE to cover the fee, reject the request with an appropriate error rather than silently failing

**Rationale:** Account creation tokens are earned passively through Resource Credits and must be claimed periodically. A provider may exhaust their token supply during high-demand periods (e.g. a successful gift card campaign) or if they haven't claimed tokens recently. The fallback ensures uninterrupted onboarding — a new user scanning a gift card should never fail because of a provider's token management. The HIVE cost is modest (currently ~3 HIVE) and is a reasonable fallback cost for the provider.

**Transfer memo format:**

The memo must be encrypted using Hive's native encrypted memo mechanism (`#` prefix). This is essential because transfer memos are permanently public on the blockchain — an unencrypted email address would be a permanent privacy leak. Wallets like Peakd and Hive Keychain support sending encrypted memos natively. The gift card service decrypts using the provider account's memo private key.

The decrypted memo contains the recipient email address. Later enhancements may accept additional arguments beyond the email address, such as:
- A chosen number of cards (e.g. bulk purchase)
- A specific card design or template
- A locale preference for robust invites

The service rejects transfers with unencrypted memos containing email-like strings, returning a refund with a memo explaining that encryption is required.

**Price and validation:**

The transfer amount must meet a configurable price threshold (e.g. 3.000 HBD per invite). The service should:
- Refund transfers below the price threshold, with an explanatory memo
- Refund transfers when invite stock is exhausted, with an explanatory memo
- Refund transfers with invalid or unparseable memos
- Handle overpayment: either refund the excess, or issue multiple cards if the amount covers more than one (TBD — operator-configurable behaviour)
- All refund memos should be encrypted back to the buyer

**Email delivery:**

The service sends invite emails using a transactional email provider via HTTP API (not raw SMTP). Candidates include SendGrid, Postmark, AWS SES, and Mailgun. Key considerations:

- *Deliverability* — transactional email services handle SPF/DKIM/DMARC, bounce management, and sender reputation automatically. Without this, invite emails are likely to land in spam, especially since they contain links and images (both spam triggers).
- *Architecture fit* — the gift card service runs on Fly.io. HTTP API integration (single env var for the API key) is simpler and more reliable than SMTP connections from containers.
- *Email content* — what to include in the email is TBD. Options range from a direct invite link + PIN in the email body, to an attached PDF card image, to a link-only approach. Attachments are heavier spam signals. Inline images or a simple link with the PIN may deliver more reliably.
- *Sender identity* — requires a verified sender domain. Whether this is the provider's own domain, a shared "Hive Invites" domain, or a project-level domain (e.g. `hiveaccessible.com`) is TBD. The sender should have a valid reply-to address for recipient questions.
- *Regulatory* — CAN-SPAM and GDPR technically apply even to transactional email. Single one-off invite emails are low risk, but bulk purchase flows (where one buyer sends many invites) need care — the recipients did not opt in, so the email should clearly identify the sender (the buyer's Hive account) and avoid marketing language.
- *Cost* — most providers have free tiers sufficient for early usage (SendGrid: 100/day, Postmark: 100/month, SES: ~$0.10/1,000). Provider choice can be deferred.

**Confirmation:**

After successfully generating and sending the invite email, the service sends a small transfer (e.g. 0.001 HBD) back to the buyer with an encrypted memo confirming delivery (e.g. "Invite sent to r\*\*\*\*\*@example.com"). This provides on-chain confirmation without fully exposing the recipient's email.

**Gift card variant:**

Which variant (standard vs robust) the purchased card uses is determined by the provider's service configuration, not by the buyer. The provider configures their service to issue one variant or the other (or could expose this as a memo argument in a later enhancement).

**Rate limiting and abuse prevention:**

- Per-account rate limits on purchases (e.g. max N invites per hour/day) to prevent abuse
- Optional blocklist for accounts that have sent spam invites
- The service should log purchase events for operator review

### Backup Restore App

✅ **Implemented.** See `restore/` and `restore/CLAUDE.md`. Hosted on GitHub Pages.

A lightweight tool for restoring account keys from the encrypted QR backup generated during the invite app onboarding flow. The invite app's key backup screen encrypts the master password with the gift card PIN and encodes it as a QR code; the restore app reverses this process.

**Core functionality:**
- Scan or upload the encrypted backup QR code (from a screenshot or printed card)
- Prompt the user for their 6-character PIN
- Decrypt the backup and display the master password and derived keys
- Provide copy-to-clipboard and key import options

**Architecture:**
- Can be a standalone single-page app, separate from both the wallet and the invite app
- Should work fully offline after initial load (all crypto bundled inline)
- Hosted on GitHub Pages alongside the invite app

**Future concern — self-bootstrapping:** The restore app could be made self-bootstrapping using the same on-chain distribution mechanism as the Propolis wallet (section 1.2.1), ensuring it remains accessible even if GitHub Pages is blocked in a target region.

### Backup App Link on Invite Card

The physical/digital invite card design should include a small QR code linking to the backup restore app, printed on the same side as the PIN. This ensures the user always has a way to find the restore tool even if they lose the original invite app URL.

**Design considerations:**
- The QR code should be small and secondary to the main invite QR — it must not cause confusion about which QR to scan first
- Label clearly (e.g. "Backup Restore" or "Key Recovery Tool") to distinguish from the main invite QR
- The URL should be stable and long-lived (e.g. a GitHub Pages URL or a short redirect under a controlled domain)
- Consider a brief text hint alongside the QR (e.g. "Lost your keys? Scan this QR with your PIN to recover them.")

### Sting Chat as Post-Onboarding Support Channel

[Sting Chat](https://peakd.com/@peak.open/sting-chat-open-source-upgrades-are-live) is an encrypted messaging system built on native Hive accounts, developed by the PeakD team. It supports private messages (2–4 users), group chats, and community channels, with encryption using Hive memo keys. It is open source ([GitLab](https://gitlab.com/peakd)), decentralized (anyone can run a node — PostgreSQL + Node.js, <1GB storage), and already integrated into PeakD and other Hive frontends.

**Why Sting Chat is a natural fit for post-onboarding support:**

- **Zero additional signup.** The user already has a Hive account after the invite flow — Sting Chat uses native Hive authentication, so there is no separate registration, phone number, or app install required.
- **Already present on PeakD.** Standard invite users who land on PeakD have Sting Chat available immediately. No onboarding friction.
- **Ecosystem-native.** Support conversations happen within the Hive ecosystem rather than on an external platform, reinforcing the user's relationship with the tools they're learning to use.
- **Decentralized operation.** The gift card provider can run their own Sting node, ensuring availability independent of PeakD's infrastructure.

**Limitations and why Signal remains primary for robust invites:**

- **Robust invite users don't land on PeakD** — they transition into the Propolis wallet, which has no Sting Chat integration. Accessing Sting Chat requires navigating to PeakD or another integrated frontend separately.
- **Web-only** — no standalone mobile app. Users must open a browser to a Hive frontend.
- **Node-dependent** — messages route through Sting nodes, not on-chain. If nodes are blocked in a restricted region, the same censorship problem applies (though traffic could potentially be routed through the existing proxy infrastructure).
- **Less battle-tested in adversarial environments** than Signal, which has years of use under hostile state surveillance with extensively audited cryptography.

**Recommended model (two-tier support):**

1. **Signal** — primary support channel during onboarding and for users in restricted regions who are stuck. Works independently of the Hive ecosystem, proven in adversarial environments, accessible via APK distribution through the proxy.
2. **Sting Chat** — post-onboarding support and ongoing community channel once the user has a working Hive account and is active on PeakD or another Sting-integrated frontend. Replaces the need for external community platforms (Telegram groups, Discord servers) for Hive-native users.

**Implementation scope:** This is a future consideration. The initial release relies on Signal only. Sting Chat integration should be evaluated once the core onboarding flow is stable and there is an active user base to support. Potential integration points include: a "Community Chat" link on the Propolis wallet's settings or help screen, and a welcome message from the provider's Hive account via Sting Chat after successful onboarding (analogous to the Stage 2 follow-up memo).

### Telegram Gift Card Bot

✅ **Implemented and deployed on Fly.io.** See `telegram-bot/` and `telegram-bot/CLAUDE.md`.

A Telegram bot that distributes Propolis gift cards within group chats. The bot operator (issuer) supplies gift cards to the bot, and group members can trigger delivery of cards to other users — either free (for the operator) or paid (for everyone else).

**Core functionality:**

- The bot operates within Telegram group chats
- The operator can load gift cards into the bot (format TBD — likely the same PDF gift cards produced by the gift card service)
- The operator can send a gift card to any user in the group via a command (e.g. `/gift @username`), free of charge
- Other group members can also trigger sending a gift card to another user, but must pay first
- When a gift card is sent, the bot delivers it to the recipient as a PDF via Telegram DM (or in-group, depending on privacy preferences)

**Payment for non-operator users:**

When a non-operator user triggers the bot, it must collect payment before releasing a gift card. Two payment methods should be supported:

1. **HBD (Hive Backed Dollars)** — direct transfer to the operator's Hive account. The bot monitors for incoming transfers with a memo that matches the pending transaction, and releases the gift card once confirmed on-chain.

2. **Bitcoin via v4v.app** — for users who hold Bitcoin but not HBD. The bot generates a v4v.app payment link/invoice that converts the BTC payment to HBD and delivers it to the operator's Hive account. The bot monitors for the resulting HBD transfer to confirm payment.

**Pricing:**
- The operator sets the gift card price (in HBD) via bot configuration
- The BTC equivalent is calculated at the time of the payment request using the current exchange rate (via v4v.app)

**Operator commands:**
- `/gift @username` — send a gift card to a user (free, operator only)
- `/load` — load gift cards into the bot (operator only, mechanism TBD — e.g. upload PDFs, or provide gift card codes)
- `/stock` — check how many gift cards remain
- `/setprice <amount>` — set the HBD price per gift card

**User commands:**
- `/buygift @username` — purchase and send a gift card to another user (triggers payment flow)
- `/buygift` — purchase a gift card for yourself

**Payment flow (non-operator):**
1. User issues `/buygift @recipient`
2. Bot responds with payment options: (a) send X HBD to `@operator-account` with memo `<unique-id>`, or (b) pay via Bitcoin using a v4v.app link
3. Bot watches for payment confirmation
4. Once confirmed, bot delivers the gift card PDF to the recipient via Telegram
5. If payment is not received within a timeout period, the transaction is cancelled

**Technical considerations:**
- The bot needs a Telegram Bot API token (created via @BotFather)
- For HBD payment monitoring, the bot watches the operator's Hive account transfer history
- For v4v.app integration, the bot needs to generate payment links and monitor for completion callbacks or poll for status
- Gift card inventory management (track which cards are available, assigned, or delivered)
- Rate limiting and anti-abuse measures for group contexts
- The bot should work in multiple groups simultaneously, all sharing the same operator and inventory

### Discord Gift Card Bot

⏳ **Not yet implemented.** The Telegram bot has been validated in production; Discord implementation is next.

A Discord bot that distributes Propolis gift cards within Discord servers. It serves the same purpose as the Telegram bot — operator-supplied gift cards distributed free or via HBD/BTC payment — but adapted to Discord's interaction model.

**Key differences from Telegram:**

- Discord bots use **slash commands** registered with the Discord API, not plain-text `/command` messages. Commands must be registered on startup and support typed parameters, autocomplete, and descriptions visible in the command picker.
- Discord has no direct equivalent of Telegram's deep links (`?start=gc_CODE`). Shareable codes are distributed out-of-band and redeemed via `/claim <code>` in any server the bot is in, or in a DM with the bot.
- Discord DMs require the bot and user to share a server, and users can disable DMs from server members. When a DM delivery fails, the bot falls back to a **claim code** (see "DM failure handling" below).
- Discord supports **ephemeral responses** (visible only to the command invoker). These should be used for payment instructions, error messages, and any sensitive output to avoid cluttering the channel.
- Discord supports **buttons and interactive components** on messages. The payment flow uses buttons (e.g. "Pay with HBD", "Pay with Bitcoin") rather than text-based instructions.
- Discord bots authenticate via a **Bot Token** from the Discord Developer Portal, and must be invited to servers via an OAuth2 URL with appropriate permission scopes.

**Core functionality:**

- The bot operates within Discord servers (guilds)
- The operator can load gift cards into the bot via a command (e.g. `/load <batch-id>`)
- The operator can send a gift card to any user via `/gift @user`, free of charge
- Other server members can purchase and send gift cards via `/buygift [@user]`
- Gift cards are delivered as PNG images via Discord DM (converted from PDF, same as Telegram bot)
- The bot should work across multiple servers simultaneously, sharing the same operator and inventory

**Payment for non-operator users:**

Same two payment methods as the Telegram bot:

1. **HBD** — direct transfer to the operator's Hive account with a memo matching the pending transaction
2. **Bitcoin via v4v.app** — generates a Lightning invoice that converts BTC to HBD

**Interaction flow (purchase via buttons):**

1. User issues `/buygift [@recipient]` in a server channel
2. Bot responds with an **ephemeral embed**: "Gift card for @recipient — 5.000 HBD" with two buttons: **[Pay with HBD]** and **[Pay with Bitcoin]**
3. User clicks **[Pay with HBD]**:
   - Bot edits the ephemeral message to show payment details: "Send 5.000 HBD to @hive-account with memo `pay-a1b2c3d4`. Payment expires in 30 minutes." with a **[Cancel]** button
4. User clicks **[Pay with Bitcoin]**:
   - Bot calls v4v.app to generate a Lightning invoice
   - Bot edits the ephemeral message to show the BOLT11 invoice string and a v4v.app payment link, with a **[Cancel]** button
   - v4v.app handles BTC→HBD conversion and sends HBD to the operator account with the same memo, so the transfer monitor handles it identically to a direct HBD payment
5. **[Cancel]** button: releases the reserved card and marks the payment as cancelled
6. Transfer monitor detects the on-chain payment (same 15-second polling as Telegram):
   - Bot DMs the buyer: "Payment confirmed!" with the gift card images
   - If a different recipient was specified, bot also DMs the recipient with the card images
   - Bot posts a non-ephemeral confirmation in the originating channel (no card details — just "Gift card delivered to @recipient!")
7. If payment is not received within the timeout period, the reservation expires and the card is released

**DM failure handling (claim code fallback):**

Discord users can disable DMs from server members. When a DM delivery attempt fails:

1. Bot generates a claim code using the existing `shared_links` infrastructure (same mechanism as `/share`)
2. Bot sends an **ephemeral message** to the buyer in the originating channel: "I couldn't DM @recipient. They can claim their card with `/claim ABC123` in a DM with me, or in any server I'm in."
3. The card stays in "reserved" state, linked to the claim code
4. The buyer can pass the code to the recipient through any channel they like
5. Recipient runs `/claim ABC123` — the bot delivers the card images in that context (DM or ephemeral in-channel)
6. If the claim code is not redeemed within 7 days, the card is released back to inventory

This reuses the `shared_links` table and deep-link redemption logic already built for the Telegram bot.

**Operator commands:**

- `/gift @user` — send a gift card (free, operator and trusted users only; other users are redirected to `/buygift`)
- `/load <batch-id>` — load gift cards from a batch directory (operator only)
- `/stock` — check inventory counts (ephemeral response)
- `/setprice <amount>` — set the HBD price per gift card
- `/share [count]` — generate claimable codes; bot responds (ephemeral) with codes and instructions
- `/clear <batch-id>` — remove available cards from a batch
- `/trust @user` — allow a user to gift for free
- `/untrust @user` — revoke free gifting privilege
- `/trusted` — list trusted users

**User commands:**

- `/buygift [@user]` — purchase and send a gift card (triggers payment flow); omit recipient to buy for yourself
- `/claim <code>` — claim a gift card from a shared code

**Shareable distribution:**

Since Discord lacks Telegram-style deep links, shareable codes work differently:

- Operator uses `/share [count]` to generate short codes
- Codes can be distributed anywhere (other platforms, printed, etc.)
- Recipients use `/claim <code>` in any server the bot is in, or in a DM with the bot
- Each code is single-use; claimed codes cannot be reused

**Permissions and security:**

- Operator commands are restricted by Discord user ID (configured at deployment via `OPERATOR_DISCORD_ID` env var)
- The bot should request only the minimum required Discord permissions: Send Messages, Embed Links, Attach Files, Use Slash Commands
- Sensitive information (payment details, card images) must only be sent via DM or ephemeral messages — never in public channels
- The bot should use Discord's built-in **role-based permissions** or command permission overrides to restrict operator commands at the Discord level, in addition to the user ID check

**Technical considerations:**

- Built on **discord.js** (the standard Discord bot library for Node.js)
- Slash commands must be registered via the Discord API on startup (or via a deploy-commands script)
- The bot needs `DISCORD_BOT_TOKEN` and `DISCORD_APPLICATION_ID` environment variables (from the Discord Developer Portal)
- Runs in the **same process** as the Telegram bot, sharing the SQLite database, Hive transfer monitor, and PDF-to-image pipeline
- Card delivery reuses the same `pdf-to-images.ts` conversion; Discord supports sending PNG attachments in DMs
- The bot should handle Discord's **rate limits** gracefully (Discord enforces per-route rate limits on API calls)
- Gateway intents required: Guilds, GuildMessages (and potentially GuildMembers if resolving users by mention)

**Database changes for multi-platform support:**

The existing SQLite schema needs a `platform` column added to the `cards`, `payments`, and `trusted_users` tables to distinguish Telegram vs Discord users. This is backwards-compatible: `ALTER TABLE ADD COLUMN platform TEXT NOT NULL DEFAULT 'telegram'` preserves all existing data. The `shared_links` table does not need a platform column — claim codes are platform-agnostic and redeemable from either bot.

### Signal Gift Card Bot

⏳ **Not yet implemented.** Future consideration — Signal's strong privacy model makes it a natural fit for restricted-region users who may not trust or have access to Telegram.

**Why Signal:**

Signal's end-to-end encryption and minimal metadata collection align with the project's goal of serving users in regions where internet access is restricted or surveilled. It is already listed as the primary support channel for restricted-region users.

**Key differences from Telegram:**

- **No official bot API** — Signal does not provide a bot platform. Bots are built using community tools, primarily [signal-cli](https://github.com/AsamK/signal-cli) (a Java-based CLI client) wrapped by [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) (Dockerized REST API).
- **Dedicated phone number required** — the bot needs its own phone number registered with Signal. A prepaid SIM is the most reliable option; the SIM only needs to be active for initial SMS verification, after which signal-cli maintains the session independently. Using a personal number would deregister the owner's Signal app.
- **No inline keyboards or buttons** — Signal has no rich UI elements. All interaction must be text-command based, which adds friction compared to Telegram's button-driven flows.
- **No group admin features** — limited bot permissions compared to Telegram; the bot cannot manage group membership or enforce rules.
- **No deep links** — Signal has no equivalent of Telegram's `?start=` deep links for one-click claim flows.

**Candidate frameworks:**

1. **signal-cli-rest-api** — Dockerized REST API wrapping signal-cli. Most common foundation for Signal bots. The bot logic would call a local REST API rather than a platform-hosted API like Telegram's.
2. **signalbot** (Python, MIT) — higher-level bot framework built on signal-cli-rest-api with command/trigger abstractions. Actively maintained. Would require Python rather than the existing TypeScript stack.
3. **Sentz/Forest SDK** — payments-enabled bot framework for Signal, potentially relevant for the paid gift card flow.

**Technical considerations:**

- The bot would need to run signal-cli (Java) as a sidecar service alongside the bot process, typically via Docker Compose
- Shares the same SQLite database, Hive transfer monitor, and PDF-to-image pipeline as the Telegram bot
- The text-only interaction model means payment flows would be more verbose (no buttons to select payment method; users would type commands like `pay hbd` or `pay btc`)
- signal-cli must remain running continuously to maintain the Signal session; session loss requires re-registration with the phone number
- Deployment on Fly.io would need persistent storage for the signal-cli session data
