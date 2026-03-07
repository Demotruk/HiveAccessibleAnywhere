# Propolis Wallet

A self-contained, on-chain-distributed Hive wallet that runs in any modern browser with no installation.

Propolis builds itself from data stored on the Hive blockchain. A small bootstrap HTML file fetches, verifies, and assembles the full wallet — no server, no extension, no app store required.

## Try It

Scan a QR code or click a link to launch the wallet directly from on-chain data:

| English | Chinese |
|---------|---------|
| [Launch Wallet (EN)](https://demotruk.github.io/HiveAccessibleAnywhere/propolis-bootstrap-en.html) | [Launch Wallet (ZH)](https://demotruk.github.io/HiveAccessibleAnywhere/propolis-bootstrap-zh.html) |

## Features

- **No installation** — opens in any browser, desktop or mobile
- **Self-bootstrapping** — the wallet loads itself from the Hive blockchain
- **Keys never leave your device** — all transaction signing happens locally
- **Transfers** — send and receive HIVE and HBD
- **HBD Savings** — stake, unstake, and track interest (~20% APR)
- **QR code login** — scan keys from a QR code instead of typing
- **Offline capable** — cached locally after first load
- **Multilingual** — English and Chinese
- **Integrity verified** — every code chunk is validated against an on-chain SHA-256 hash manifest before execution

## How It Works

1. A **bootstrap HTML file** (~47 KB) is the trust anchor. It contains the publisher account and verification logic.
2. The bootstrap calls `bridge.get_discussion` to fetch the wallet's root post and its comments from the Hive blockchain.
3. Each comment contains a chunk of the wallet code (~55 KB each). Only comments from the publisher account are processed.
4. Every chunk is verified against the SHA-256 hash manifest in the root post's `json_metadata`.
5. **All chunks must pass verification before any code executes.** No partial execution, no exceptions.
6. The assembled wallet is cached in `localStorage` for offline use and auto-updates when a new version is published.

## Project Structure

```
wallet/           Propolis Wallet (Vite + TypeScript, single-file HTML output)
  src/
    ui/           Login, balance, transfer, savings, settings screens
    hive/         RPC client, key management, memo crypto, tx signing
    discovery/    Endpoint feed discovery, RPC manager
    obfuscation/  Traffic obfuscation codec (Phase 2)
    __tests__/    Vitest unit tests
scripts/          Publishing and infrastructure tooling
  distribute-onchain.ts   Build + publish wallet to blockchain
  publish-bootstrap.ts    Publish bootstrap as a readable Hive post
  publish-feed.ts         Send encrypted endpoint memos to subscribers
  deploy-proxy.ts         Deploy RPC proxy instances to Fly.io
  generate-qr.ts          Generate QR codes for bootstrap URLs
proxy/            RPC proxy server (Express, method allowlist, cover site)
docs/             GitHub Pages — landing page, bootstrap files, QR codes
```

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
cd wallet && npm install
cd ../scripts && npm install
```

### Build

```bash
cd wallet
npm run build          # Phase 1 (default)
npm run build:phase2   # Phase 2 (with proxy/obfuscation UI)
npm run build:all      # Both locales (en + zh)
```

### Test

```bash
cd wallet
npm test               # Run unit tests (Vitest)
npm run test:watch     # Watch mode
```

```bash
cd scripts
npm test               # Integration tests (requires .env)
npm run test:readonly  # Read-only integration tests
```

### Dev Server

```bash
cd wallet
npm run dev            # http://localhost:5174
```

### Publish On-Chain

```bash
cd scripts
# Set PROPOLIS_ACCOUNT and PROPOLIS_POSTING_KEY in .env
npm run distribute     # Publish wallet chunks + generate bootstrap
npm run publish-bootstrap  # Publish bootstrap as Hive post
```

## Architecture

### Phase 1 — Propolis Wallet (current)

A portable Hive wallet usable by anyone in the Hive community. Connects directly to public Hive API nodes. Distributed entirely on-chain.

### Phase 2 — Restricted Access Infrastructure

For users in regions where Hive RPC nodes are blocked:

- **RPC proxy network** — relay nodes that present as ordinary websites
- **Traffic obfuscation** — JSON-RPC wrapped as REST-like requests (gzip + base64)
- **Encrypted endpoint discovery** — per-user proxy URLs delivered via Hive memo encryption
- **Cover sites** — proxies serve themed facades (food blog, photography, etc.)

Phase 2 code is present in the codebase but hidden in Phase 1 builds via dead-code elimination.

### Security Model

- Private keys are generated and stored on the user's device only
- Transaction signing is local — proxies are untrusted relays
- Bootstrap verification: author filtering + SHA-256 hash manifest + verify-all-before-executing-any
- Per-user endpoint feeds prevent single-point compromise
- Endpoint-to-user-group mapping enables leak tracing

## License

[MIT](LICENSE)
