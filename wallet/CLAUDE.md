# Propolis Wallet

A self-contained, single-file HTML Hive wallet distributed on-chain. No framework — vanilla TypeScript with hash-based routing.

## Status

Phase 1 shipped and published on-chain for all 7 locales. Phase 2 features (proxy, obfuscation, endpoint discovery) are in the codebase but gated behind `isPhase2()`.

## Architecture

- **Single HTML file** — Vite + `vite-plugin-singlefile` bundles everything inline
- **No framework** — vanilla TypeScript, DOM manipulation, hash-based routing in `src/ui/app.ts`
- **Screens**: login, balance, transfer, savings, settings (+ QR scanner component)
- **7 locales**: en, zh, ar, fa, ru, tr, vi — translations in `src/ui/locales/`

## Key Source Layout

```
src/
  main.ts              # Entry point, exports console API
  phase.ts             # isPhase2() feature gate
  ui/
    app.ts             # Main app controller, hash routing
    components/        # Screen components (login, balance, transfer, savings, settings, qr-scanner)
    locales/           # i18n translations
  hive/
    client.ts          # RPC client
    signing.ts         # Transaction signing (local only)
    operations.ts      # Hive operations
    keys.ts            # Key import/management
    memo.ts            # Memo encryption/decryption
  discovery/
    endpoint-feed.ts   # Proxy endpoint discovery via encrypted memos
    rpc-manager.ts     # RPC endpoint manager with failover
  obfuscation/
    codec.ts           # Traffic obfuscation encode/decode
    manager.ts         # Obfuscation feature gating
```

## Hard Constraints

- **170KB size limit** — built HTML must stay under 170KB (current: en/zh ~167KB, ar/fa ~169KB, ru ~170KB)
- **Size is critical** — every byte matters for on-chain distribution. Avoid adding dependencies.
- **Must work offline** after first bootstrap (signing, key management)
- **Private keys never leave the device** — all signing is local via `src/hive/signing.ts`
- **No external requests except Hive RPC** — no analytics, no CDN, no external assets

## Build

```bash
npm run build              # Phase 1, default locale (en)
npm run build:phase2       # Phase 2
npm run build:all          # All 7 locales (Phase 1)
npm run check-size         # Verify bundle size
npm run dev                # Dev server
npm run test               # Vitest
```

`PHASE=2` env var activates Phase 2. `LOCALE` env var selects locale. `build-locales.js` iterates all 7.

## Phase 2 Gating

`isPhase2()` in `phase.ts` checks the build-time `PHASE` env var. All Phase 2 UI and logic is wrapped in `if (isPhase2())` blocks. Vite dead-code-eliminates these in Phase 1 builds, so they add zero bytes to Phase 1 output.

Phase 2 capabilities (currently gated):
- Traffic obfuscation (`src/obfuscation/`)
- Encrypted endpoint discovery via memo feed (`src/discovery/endpoint-feed.ts`)
- Proxy endpoint management (`src/discovery/rpc-manager.ts`)
- Pre-authenticated startup (credentials in localStorage from invite handoff)

## localStorage Keys

Phase 1: `haa_*` prefix (kept for migration)
Phase 2: `propolis_*` prefix

Key localStorage entries:
- `propolis_manual_endpoints` — proxy endpoints (written by invite app handoff)
- `propolis_bootstrap_memo_key` — memo key for endpoint discovery
- Cached wallet HTML for offline use

## On-Chain Distribution

The wallet is published as a Hive post with chunk comments:
- Root post: `json_metadata.propolis` contains hash manifest
- Comments: code chunks at 55KB each, code-fenced
- Bootstrap HTML fetches via `bridge.get_discussion`, verifies SHA-256 hashes, assembles
- Only publisher-authored comments processed; all verified before any execution

Publishing is done via `scripts/distribute-onchain.ts` (not part of this package).

## Testing

Vitest tests in `src/__tests__/`. Run with `npm run test`.
