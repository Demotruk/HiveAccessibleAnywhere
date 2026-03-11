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

**Phase 1a — Minimum viable release:**
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
- Be distributable on-chain as a single Hive post plus its comments (each post/comment body has a ~65KB limit, so the wallet is split across as many comments as needed under one root post)
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
- Split it into chunks that fit within the Hive comment body limit (~65KB each)
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

**Scaling consideration:** The initial proof-of-concept deploys two proxy instances (London and Singapore) using Fly.io's free tier with auto-stop to minimise costs. Additional instances in other regions (e.g. US, Frankfurt, Tokyo) should be deployed as users come onboard, scaling with demand rather than provisioning speculatively. Each 256MB shared-CPU instance is lightweight and costs are negligible when auto-stopped, so scaling can be reactive.

### 2.4 Gift Card Onboarding

The primary onboarding mechanism for new users. A QR-based system that provides account provisioning via a scannable code, suitable for physical or digital distribution. Existing Hive systems for account creation and invites have not achieved major growth; the gift card system is novel and designed for instant, autonomous onboarding without human approval bottlenecks.

**Concept:**
A "gift card" (physical card, printout, or digital image) contains a QR code and a 6-character alphanumeric PIN. When scanned, the QR opens a lightweight **invite app** in the browser — a single-purpose onboarding application, separate from the Propolis wallet. The user enters the PIN to decrypt the embedded data, which contains a **claim token** entitling the holder to redeem a specific **promise** — typically creating a Hive account with a username of their choice. The promise type is extensible: while account creation is the initial implementation, a gift card could also promise a HIVE/HBD transfer, an HP delegation, or a combination of actions. Redemption happens within seconds.

The invite app is deliberately separate from the wallet to keep both codebases focused: the invite app handles one-time onboarding (PIN entry, key generation, account claim), while the wallet handles ongoing key management and transactions. After account creation, the invite app hands the user off to the appropriate wallet experience. Initially the invite app is hosted as a static site on GitHub Pages; it can later be migrated to on-chain bootstrapping (using the same mechanism as the wallet, section 1.2.1) if censorship resistance is needed for the onboarding flow.

**Gift card variants:**
Gift cards come in two variants, determined at batch generation time. The variant is a batch-level attribute stored in the encrypted payload as the `variant` field.

1. **Standard invites** — for countries with unrestricted internet access. The encrypted payload does not include proxy endpoints. The invite app uses public Hive API nodes directly for on-chain operations (signature verification, username availability checks). After account creation, the invite app redirects the user to peakd.com via HiveSigner OAuth login — the target end state is the user logged into peakd.com, on any device. PeakLock (Peakd's built-in browser key storage) is available as a fallback. The gift card service does not enroll the new user in the proxy endpoint feed. Standard invites are simpler to operate: the provider does not need proxy infrastructure, only a gift card service and sufficient account creation tokens.

   **Standard invite handoff — staged onboarding:**
   The handoff prioritises getting the user active on Hive immediately, with security upgrades deferred to a follow-up prompt.

   *Stage 1 — Immediate (seconds after account creation):*
   The invite app shows a congratulations screen confirming the account exists on-chain, then guides the user to log into peakd.com using **HiveSigner** — an open-source OAuth2 provider that requires no install or extension. The invite app redirects the user to HiveSigner's import page with peakd.com pre-configured as the OAuth callback. The user enters their username and posting key, clicks Login, and is redirected back to peakd.com fully authenticated. The user is browsing Hive within a minute of account creation.

   **PeakLock** (Peakd's built-in browser key storage) remains available as a fallback option if HiveSigner is unavailable or if a PeakLock deep link feature is implemented by the Peakd team (see implementation notes below).

   *Stage 2 — Follow-up (days later, optional):*
   The gift card service sends a small transfer (e.g. 0.001 HBD) to the new account with a welcome memo containing a link to Hive Keychain setup instructions. This appears in the user's transaction history on Peakd, serving as a gentle nudge to upgrade their security. The memo could link to a guide for installing the Hive Keychain mobile app (Android/iOS) or browser extension (Chrome/Firefox/Brave), which provides better key management and multi-app support than HiveSigner or PeakLock.

   *HiveSigner implementation notes (investigated March 2026):*
   HiveSigner is an open-source (MIT, `ecency/hivesigner-ui`) OAuth2 provider. Its `/import` page accepts query parameters: `client_id`, `redirect_uri`, `scope`, `response_type`, `state`, `authority`. The form has two fields (username, private key) and an optional "Save and encrypt" checkbox. After successful login, the user is redirected back to the callback URL (peakd.com) with an authorization code.

   Confirmed behaviour:
   - The `&username=` URL parameter is **not** currently supported (confirmed by source code review — the username is stored in Vuex, not read from the URL)
   - If `scope=posting` and the client app (peakd.app) is not in the account's posting authorities, HiveSigner requires an active key or master password to add the authority — a posting key alone will trigger an error
   - Keys are stored encrypted on HiveSigner's servers (semi-custodial), not in the browser
   - The OAuth redirect flow provides a clean UX: invite app → HiveSigner → peakd.com, all automatic

   Step comparison (HiveSigner vs PeakLock):
   - **HiveSigner** (~3-5 user actions): paste username, paste key, click Login, [possibly click Authorize if peakd.app not pre-authorized], auto-redirect to peakd.com
   - **PeakLock** (~7 user actions): click link to peakd.com, click login icon, click PeakLock, click Add Account, paste username, paste posting key, enter 5-digit PIN

   Options for reducing HiveSigner friction, in order of preference:
   - **Pre-authorize peakd.app during account creation** *(no cooperation needed)*: Add `["peakd.app", 1]` to the posting authority's `account_auths` in the `create_claimed_account` operation. This eliminates the authorization step entirely — the user only needs to paste username + posting key + click Login (~3 actions). This is the recommended approach.
   - **Submit PR for `&username=` URL parameter** *(no cooperation needed — open source)*: A trivial change to `import.vue` to read `this.$route.query.username` and initialize `PersistentFormsModule.import.username`. Would reduce to ~2 user actions (paste key + click Login) when combined with pre-authorization.
   - **Programmatic form fill via native input setter** *(technically proven but impractical)*: Works from same-origin JavaScript but blocked by cross-origin restrictions from the invite app domain.

   *PeakLock implementation notes (investigated March 2026):*
   PeakLock is a Vue 2 component within peakd.com that stores posting keys encrypted with a 5-digit PIN in the browser's localStorage. The PeakLock "Add Account" form has three fields: Hive account (text), Hive Posting Key (password), and a 5-digit PIN code. Investigation confirmed that form fields can be programmatically pre-filled using native input value setters with Vue-compatible event dispatch — but only from JavaScript running on peakd.com itself. The invite app (hosted on a different domain) cannot manipulate peakd.com's DOM due to cross-origin restrictions.

   Confirmed constraints:
   - PeakLock source is not publicly available (shared privately by the PeakD team with select developers)
   - No URL parameter or deep link support exists — `peakd.com/?login=peaklock&username=x` has no effect
   - No `postMessage` API for cross-origin PeakLock interaction
   - The login modal is triggered only by clicking the UI login button → PeakLock → Add Account

   PeakLock fallback options:
   - **Deep link with pre-fill** *(requires Peakd cooperation — feature request to @asgarth)*: A URL like `peakd.com/?action=peaklock&account=username` that auto-opens the PeakLock modal with the username pre-filled. The user would only need to paste their posting key and choose a PIN. This is technically straightforward on Peakd's side (the form-fill code already works, it just needs a URL trigger) and benefits any Hive onboarding tool, not just this project.
   - **Clipboard + instructions** *(works today, no cooperation needed)*: Copy the posting key to clipboard, open peakd.com in a new tab, and display step-by-step instructions: (1) click login icon, (2) click PeakLock, (3) click Add Account, (4) type username (shown prominently in invite app), (5) paste key, (6) choose PIN, (7) Save. The invite app retains the username and key in memory so they can be re-displayed at any point.

   *Tradeoffs — HiveSigner vs PeakLock:*
   HiveSigner is semi-custodial (keys stored encrypted on HiveSigner's servers) while PeakLock is non-custodial (keys in browser localStorage). For new users in the immediate handoff, the HiveSigner convenience tradeoff is acceptable — the Stage 2 follow-up encourages upgrading to Hive Keychain, which is fully non-custodial and replaces both HiveSigner and PeakLock.

   The handoff flow should be as hand-held as possible — the user has just created their first Hive account and may have no prior blockchain experience. Each step should include clear instructions and confirmation that the step was completed before advancing. The invite app retains the user's keys in memory during this flow so they can be copied or re-displayed at each stage; keys are cleared from memory once the user confirms they have successfully logged into Peakd, or when the page is closed.

2. **Robust invites** — for countries with restrictive internet where Hive infrastructure may be blocked. The encrypted payload includes one or more proxy endpoint URLs. The invite app uses these proxy endpoints for all on-chain operations during onboarding. After account creation, the gift card service enrolls the new user in the proxy endpoint feed, and the invite app hands the user off to the Propolis wallet pre-configured with proxy access. Robust invites require the full Phase 2 infrastructure (proxy network, endpoint feed, Propolis wallet).

The invite app adapts its flow based on the variant: the core onboarding steps (PIN entry, verification, username selection, key backup, account claim) are identical, but the RPC access method, post-claim handoff destination, and endpoint enrollment differ. The invite app hosted on GitHub Pages serves both variants — on-chain bootstrapping of the invite app (section 1.2.1) is only needed if GitHub Pages itself becomes inaccessible in a target region, which is primarily a concern for robust invite deployments.

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
- `endpoints` — *(robust only)* one or more proxy endpoint URLs (used by the invite app for RPC access during onboarding, and passed to the wallet after account creation). Omitted or empty for standard invites
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
12. Invite app confirms account creation and begins the handoff flow. For **standard invites**, the invite app congratulates the user and redirects them to peakd.com via HiveSigner (OAuth login — no install required). For **robust invites**, the invite app links to the Propolis wallet (bootstrap URL), pre-configured with the user's proxy endpoints

**Integration with existing infrastructure:**
- The invite app is a lightweight static site hosted on GitHub Pages (or any public CDN), separate from any wallet. It serves both standard and robust invite variants. It can be migrated to on-chain bootstrapping (section 1.2.1) in the future for censorship resistance, primarily relevant for robust invites in regions where GitHub Pages may be blocked
- For robust invites, the proxy endpoints embedded in the encrypted data are from the proxy network (section 2.3), giving the invite app RPC access for signature verification and username availability checks, and giving the new user immediate proxy access when they transition to the Propolis wallet
- For standard invites, the invite app uses public Hive API nodes directly and redirects the user to peakd.com via HiveSigner OAuth login (no install required). PeakLock is available as a fallback. Hive Keychain is recommended as a follow-up upgrade via transfer memo. No proxy infrastructure is required
- After account creation, the user transitions to the appropriate wallet experience. For robust invites, the Propolis wallet bootstraps independently from on-chain code (section 1.2.1) and operates identically regardless of how the user's account was created
- The gift card service is independent of both the invite app and the proxy — it only needs to reach a Hive API node (directly or via proxy) to broadcast the account creation transaction

**Endpoint subscription enrollment** *(robust invites only)*:
When the gift card service creates a new account via a robust invite, it signals the endpoint subscription service by sending a small transfer (e.g. 0.001 HBD) to the service account (e.g. `haa-service`) with the new username in the memo. The endpoint feed publisher (section 2.1) recognises this as a subscription request and includes the new user in the next feed update. This keeps the feed publisher's keys separate from the gift card service's keys. For standard invites, this step is skipped — the new user accesses Hive through public API nodes and does not need proxy endpoints.

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

**Limitations:**
- The invite app URL in the QR must be accessible in the user's region. GitHub Pages and major CDNs are broadly accessible, but could be blocked in extreme cases. If this becomes a problem, the invite app can be migrated to on-chain bootstrapping (section 1.2.1) for censorship resistance
- Gift cards have a shelf life determined by both the token expiry (default: 1 year) and the longevity of the invite app URL and service URL
- The gift card service must be reachable at redemption time — if the service is down, the token remains valid for later use (assuming it has not expired)
- The initial HP delegation is a cost borne by the gift card provider; it should be small enough to enable basic transactions but represents a capital commitment that is recovered when the delegation is eventually removed
- After account creation, the user must transition from the invite app to their target wallet experience. For robust invites, the invite app provides a direct link to Propolis with pre-configured proxy endpoints. For standard invites, the invite app redirects the user to peakd.com via HiveSigner OAuth — this involves a cross-domain redirect where the user must enter their username, paste their posting key, and click Login (~3 user actions). If peakd.app is pre-authorized during account creation, no additional authorization step is needed. The invite app must retain keys in memory throughout this handoff so the user can re-access them at each step
- **HiveSigner username pre-fill limitation**: HiveSigner does not currently read a `username` URL parameter (confirmed by source code review, March 2026). Since HiveSigner is open source (MIT, `ecency/hivesigner-ui`), a PR can be submitted to add this trivial feature. PeakLock likewise has no URL-based pre-fill (closed source, feature request made to @asgarth)
- **TLS certificate acceptance for LAN deployments:** When the gift card service runs on a local network (e.g. internet café, community centre, offline kiosk) rather than behind a public domain with a valid certificate, the invite app's `fetch()` requests to the service will silently fail unless the user has previously accepted the self-signed certificate warning by visiting the service URL directly. This is a browser security constraint — `fetch()` to an untrusted HTTPS origin is rejected without user interaction, and the invite app cannot trigger the browser's certificate acceptance UI programmatically. A future UX improvement could detect LAN/IP-based service URLs and prompt the user to verify the connection (opening the service health endpoint in a new tab) before attempting the claim. This is not an issue for public deployments with valid TLS certificates (e.g. Let's Encrypt)

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
- **Account creation slow / failed:** Account creation was consistently slow for all testers who reached that step. Investigation shows two compounding causes: (1) the giftcard service on Fly.io is configured with `min_machines_running: 0` and `auto_stop_machines: 'stop'`, meaning cold starts of 10-30+ seconds before the service can even process a request; (2) the on-chain `create_claimed_account` transaction adds 3-10 seconds on top. The wallet has no timeout, no retry logic, and no pre-flight wake-up call — the `/health` endpoint exists on the service but is never used by the client. A warm-up ping earlier in the flow (e.g. during username selection or validation) would mask cold-start latency. The UX should also set expectations with a progress indicator and estimated wait time.
- **HiveSigner handoff incomplete:** Tester A created an account and proceeded to HiveSigner but did not complete login. The multi-step handoff (copy username, copy key, navigate to HiveSigner, paste credentials) is too many steps for a first-time user with no blockchain experience. Two improvements are in progress from upstream maintainers:
  - **Option A — PeakLock direct login (preferred):** @asgarth (peakd.com) will add a query-string login endpoint so the invite app can open `peakd.com/?username=foo&login=peaklock` directly. The user only needs to paste one key. Eliminates the HiveSigner middleman entirely — fewer redirects, user lands on the destination site immediately. Pending @asgarth's implementation (peakd.com is closed-source).
  - **Option B — HiveSigner username pre-fill (fallback):** @good-karma (hivesigner) is open to a PR adding `&username=` query parameter support to the OAuth flow. The invite app would copy the posting key to clipboard before opening HiveSigner, reducing the flow to: click button → paste key → login. PR target: `ecency/hivesigner-ui`. Security consideration: the username parameter must only pre-fill the input field, never bypass authentication or auto-submit.
- **Overall flow too clunky:** The end-to-end process has too many discrete steps requiring user action. Each step is a drop-off point. The flow should be streamlined to minimise the number of user decisions and manual actions between scanning the QR and reaching a usable Hive experience.

**Additional UX improvements (standard invite flow):**

- **Step progress indicator:** Users have no sense of where they are in the flow or how many steps remain. A simple step counter or progress bar (e.g. "Step 2 of 5") at the top of each screen would set expectations and reduce abandonment. The flow has 5 user-facing stages: PIN → Verifying → Username → Backup → Claiming/Success.
- **Auto-copy posting key on HiveSigner redirect:** When the user clicks the HiveSigner login button on the success screen, auto-copy the posting key to clipboard before opening the tab. This eliminates the separate "Copy" step — the user only needs to paste.
- **Estimated wait time on claiming/verifying screens:** Replace the bare spinner with an explicit time estimate (e.g. "This usually takes 10–20 seconds"). Users who see only a spinner with no time context assume the app is broken and abandon the flow.
- **Timeout with actionable message:** Neither the verifying nor claiming screen has visible timeout handling. After ~30 seconds, show an actionable message: "This is taking longer than usual — your gift card is still valid. You can retry or try again later." rather than spinning indefinitely.
- **Service warm-up at PIN entry:** The `/health` warm-up ping currently fires on the verifying screen. Moving it to the PIN entry screen gives Fly.io 2–3 additional screens of warm-up time (PIN entry + verifying + username selection) before the `/claim` request, further masking cold-start latency.
- **Confirmation summary before claiming:** Show a brief confirmation ("You're about to create account **@username** on the Hive blockchain") before the irreversible claim step. Catches typos and gives the user a moment of intentionality before the point of no return.
- **Username suggestions on collision:** When a chosen username is taken, suggest available variations (e.g. appending digits or hyphens). First-time users unfamiliar with Hive naming conventions may get stuck in trial-and-error.
- **Back navigation:** There is currently no way to return to a previous screen. At minimum, the username and backup screens should allow going back. If a user picks a username and has second thoughts during backup, they are stuck.
- **Claiming idempotency guidance:** If the `/claim` request times out but the server actually succeeded, the retry button re-posts and may fail with "username taken." The service should handle idempotent retries (return success if the same token+username was already fulfilled), and the UI should guide the user: "If your account was already created, try logging in directly."
- **Mobile credential font sizes:** The posting key on the success screen is displayed at `.7rem`, which is likely too small on phone screens. Credential displays should use at least `.85rem` with horizontal scroll rather than wrapping, to remain legible on mobile devices where the entire flow runs (QR scan entry point).
- **PIN input visual segments:** Show filled dots or discrete character slots as each character is entered (similar to a phone unlock screen), making the 6-character target visually clear rather than relying on a plain text input.
- **Offline detection:** Check `navigator.onLine` before network-dependent screens (verifying, username availability, claiming) and show a connection warning upfront rather than letting the request fail with a generic network error.
- **Invite app i18n:** The wallet supports 7 locales but the invite app is English-only. Since the target audience includes users in China, Iran, Russia, Turkey, and Vietnam, locale detection (from the gift card payload or browser language) would make the first experience more welcoming. This is a larger effort but aligns with the project's mission of accessibility anywhere.

### 2.5 Onboarding Service (General)

The gift card system (section 2.4) is the primary onboarding mechanism. This section describes the general onboarding service capabilities that support gift card onboarding and may also support other onboarding channels in the future (e.g. web-based signup, Telegram bot, invite system).

The onboarding service:
- Is reachable through channels that are accessible in restricted regions (e.g. CDN-fronted website, Telegram bot, or in-person via gift cards)
- Provisions new Hive accounts using account creation tokens
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

A modified version of the Hive Keychain browser extension that integrates the same RPC endpoint discovery and traffic obfuscation capabilities as the self-contained wallet tool.

**Purpose:** Existing Hive users who already use Hive Keychain can install this modified version *before* traveling to a region with restricted internet access, giving them continued access to Hive through a familiar interface.

**Requirements:**
- Integrates per-user encrypted memo endpoint discovery (same mechanism as the wallet tool, section 2.1)
- Supports the same traffic obfuscation protocol (section 2.2) for RPC communication
- Falls back to discovered proxy endpoints automatically when direct RPC access fails
- Retains all standard Keychain functionality — signing, account management, dApp integration
- Users can configure their service account (the account that sends endpoint memos) within the extension settings

**Limitations:**
- This is **not a solution for users inside restricted regions who lack prior access.** Browser extension stores (Chrome Web Store, Firefox Add-ons) may themselves be blocked or restricted. The modified Keychain cannot be installed from within a restricted environment.
- It is intended for users who **already have Hive accounts and Keychain installed**, and who want to maintain access when traveling to or residing in restricted areas.
- Distribution of this extension is through conventional channels (extension stores, sideloading from a trusted source). It does not need on-chain distribution — users install it while they still have unrestricted access.

**Relationship to the wallet tool:**
- The wallet tool (section 1.1) is for users who cannot install extensions — it works as a standalone HTML file with no installation
- The modified Keychain is for users who *can* install extensions ahead of time and prefer the richer Keychain experience
- Both share the same endpoint discovery protocol and obfuscation layer, ensuring compatibility with the same proxy infrastructure

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

Allow users to purchase gift cards by transferring Hive or HBD to the gift card provider account. If the transfer amount meets a configurable price threshold and the memo contains an email address, the gift card service produces a gift card and emails it to that address. The gift card is redeemable by the main gift card provider account.

To support this, the gift card service may also need to claim accounts using the alternative method that consumes Hive tokens (via `account_create` or the fee-based path), rather than relying solely on RC-based `claim_account` tokens.

**Later enhancements:**
- Accept additional arguments in the transfer memo beyond the email address, such as:
  - A chosen number of cards (e.g. bulk purchase)
  - A specific card design or template
