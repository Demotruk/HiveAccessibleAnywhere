---
name: deploy-onchain
description: Publish Propolis wallet on-chain (distribute chunks + bootstrap posts)
user-invocable: true
---

# Deploy On-Chain

Publish the Propolis wallet to the Hive blockchain. This is only needed when the wallet code itself has changed.

## Steps

### 1. Build all wallet locales

```bash
cd wallet && npm run build:all
```

This builds all 8 locales (en, zh, ar, fa, ru, tr, vi, es).

### 2. Verify sizes

Check that all built wallets are under the 170KB limit:

```bash
ls -la wallet/dist/propolis-*.html
```

Report any that exceed 170KB.

### 3. Distribute on-chain (MANUAL)

The distribute script requires `PROPOLIS_ACCOUNT` and `PROPOLIS_POSTING_KEY` from `scripts/.env`. Ask the user to run:

```bash
cd scripts
npx tsx distribute-onchain.ts --all-locales --version 1
```

This publishes root posts + chunk comments for each locale, with 5-minute delays between locales. It takes ~40 minutes for all 8 locales.

Wait for the user to confirm completion.

### 4. Publish bootstrap (MANUAL)

Ask the user to run:

```bash
cd scripts
npx tsx publish-bootstrap.ts --all-locales --version 1
```

This publishes readable Hive posts with the bootstrap HTML for each locale. Also takes ~40 minutes.

### 5. Update GitHub Pages

After on-chain publishing, regenerate the bootstrap files for GitHub Pages:

```bash
npm run deploy:pages
```

Commit any changes to `docs/`.

### 6. Verify

Suggest the user verify on-chain by:
- Visiting a bootstrap post on peakd.com
- Copying the HTML, saving as .html, opening in browser
- Confirming the wallet loads and verifies integrity
