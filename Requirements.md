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

## Project Scope

This project has three distinct layers:

### Layer 1 — Onboarding & Account Provisioning (Primary Focus)

A managed onboarding process that provides new users with a Hive account, the wallet tool, and a personal subscription for RPC endpoint discovery.

### Layer 2 — Accessible Hive Interaction (Primary Focus)

Enable users to perform write operations on the Hive blockchain from regions where RPC nodes are blocked, without requiring a VPN.

### Layer 3 — On/Off Ramp Integration (Future Phase)

Enable users to convert local currency to HBD and withdraw HBD back to local currency. Not in scope for initial delivery but the architecture should not preclude it.

---

## Requirements — Layer 1: Onboarding & Account Provisioning

### 1.1 Onboarding Service

A service accessible to new users who do not yet have a Hive account or access to Hive RPC nodes.

The onboarding service:
- Is reachable through channels that are accessible in restricted regions (e.g. CDN-fronted website, Telegram bot, email, or in-person)
- Accepts payment in cryptocurrency to cover setup costs
- Provisions a new Hive account for the user
- Delivers the wallet tool (the self-contained HTML file) to the user
- Enrolls the user in a personal RPC endpoint subscription feed
- Provides initial RPC endpoint(s) so the user can begin interacting with Hive immediately

### 1.2 Invite System

Existing users can onboard new users, enabling organic growth without centralized bottlenecks.

- Existing users can create Hive accounts for new users using Hive's native account creation tokens
- The inviting user can enroll the new user in the endpoint subscription feed
- This creates social accountability — if an invitee leaks endpoint information, the invite chain is traceable
- Invite capacity may be limited (e.g. N invites per user per period) to control growth rate and limit blast radius of compromised users

### 1.3 Onboarding Fee & Subscription Model

The service requires payment to cover infrastructure costs.

- **Onboarding fee (one-time)**: Covers Hive account creation and initial setup. Payable in cryptocurrency via the onboarding channel.
- **Endpoint subscription (recurring)**: Covers ongoing provision of personal RPC endpoints and proxy infrastructure. Payable in HBD via on-chain transfer to the service account.
- **Self-sustaining from interest**: A user staking HBD in savings earns ~20% APR. Even modest stakes generate enough interest to cover subscription fees. For example, 100 HBD earns ~20 HBD/year — the subscription should be priced well below this to ensure the service is a clear net positive for users.
- **Grace periods**: New users should receive an initial service period included in the onboarding fee, giving them time to acquire and stake HBD before the first subscription payment is due.

---

## Requirements — Layer 2: Accessible Hive Interaction

### 2.1 Self-Contained Wallet Tool

A standalone HTML file that functions as a minimal Hive wallet, capable of:

- **Key management**: Import and use Hive private keys (active key for transfers/savings, posting key for social operations)
- **HBD Savings operations**: Stake HBD to savings, unstake from savings, check balances and interest
- **Transfers**: Send and receive HIVE and HBD
- **Transaction signing**: Sign transactions locally in the browser — private keys never leave the device
- **Feed reading**: Locate and decrypt the user's personal RPC endpoint feed from on-chain data

The tool must:
- Be fully self-contained in a single HTML file (all JS bundled inline)
- Work offline for signing operations
- Be small enough to embed on the Hive blockchain across a small number of posts (~100KB or less target)
- Run in any modern browser on desktop or mobile, with no installation required

### 2.2 Per-User RPC Node Discovery via Encrypted Memos

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

### 2.3 Traffic Obfuscation

RPC traffic between the wallet tool and proxy nodes must be obfuscated to resist deep packet inspection (DPI).

- JSON-RPC calls should be wrapped to resemble normal HTTPS web traffic
- Proxy nodes should present as ordinary web services (e.g. a blog, an image host) to casual inspection
- The protocol should be resistant to fingerprinting of Hive-specific method names and payload structures

### 2.4 Software Distribution

The wallet tool must be distributable to users who cannot access conventional download sources.

- The complete HTML file is embedded on the Hive blockchain, split across a small number of posts
- Reassembly instructions are simple enough for non-technical users: copy text, save as .html, open in browser
- A version identifier and integrity checksum are included on-chain so users can verify they have the correct, untampered file
- Updates follow the same distribution path

### 2.5 RPC Proxy Network

A network of proxy nodes that relay RPC requests to actual Hive API nodes.

- Proxy nodes accept obfuscated requests from the wallet tool and forward them as standard RPC calls to Hive API nodes
- Proxy IPs/endpoints rotate and are announced via per-user encrypted memos
- The proxy layer adds no trust requirements — transactions are signed client-side, so proxies only relay signed data and return public blockchain state
- Proxy operators cannot steal funds or forge transactions (they never see private keys)
- Each proxy endpoint is assigned to a small group of users to enable leak tracing

---

## Security Considerations

- **Private keys never leave the client device.** All transaction signing happens locally.
- **Proxy nodes are untrusted relays.** They see signed transactions (which are public anyway once broadcast) and return public blockchain data. They cannot modify, forge, or withhold transactions without detection.
- **Per-user endpoint feeds prevent single-point compromise.** No individual user can leak information that affects other users' access.
- **Leak tracing is built in.** Endpoint-to-user-group mapping allows identification of compromised users when endpoints are blocked.
- **The wallet tool's integrity is verifiable** via on-chain checksums.
- **Users must understand the 3-day unstaking delay** for HBD savings — this is a blockchain-level property, not a limitation of the tool.
- **Invite chains create accountability.** Users who invite others are implicitly vouching for them, creating a social trust layer.

## Operational Model

### Design Principle: Operational Decentralisation

The protocol and tooling must be designed so that **no single operator is required** for the system to function. Any sufficiently motivated party should be able to run a compatible service instance independently.

This means:
- The wallet tool is open source and works with any compatible service provider
- The on-chain signaling protocol (encrypted memos with endpoint information) is documented and standardised
- Multiple independent operators can coexist, each managing their own subscriber base and proxy infrastructure
- Users can switch between service providers by simply subscribing to a different operator's feed
- The RPC proxy protocol is open, so anyone can stand up proxy nodes

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
| Proof of concept | Founder (known identity) | Technical validation only; no payments; censorship circumvention risk accepted |
| Early adoption | Founder or trusted community members | Small-scale; onboarding fees begin; legal exposure increases |
| Mature operation | Independent operators (may be pseudonymous) | Decentralised; founder may or may not continue operating; protocol is self-sustaining |

The architecture must support all three phases without structural changes. The transition from founder-operated to community-operated should require no changes to the wallet tool or user experience — only a change in which account sends the encrypted endpoint memos.

---

## Non-Functional Requirements

- **No server dependency for core operations.** The wallet tool must function with any working RPC endpoint — it has no "home server."
- **Minimal trust assumptions.** Users trust only the Hive blockchain itself and their own key management. Everything else (proxies, signaling feed, distribution) is verifiable or replaceable.
- **Graceful degradation.** If the endpoint feed is unavailable, users can manually enter a known RPC endpoint. If proxies are blocked, users can fall back to a VPN. The tool should always remain functional given *any* working RPC connection.
- **Subscription pricing must leave clear margin.** The subscription fee should be a small fraction of HBD savings interest, ensuring the service is obviously worthwhile to users.
