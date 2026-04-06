---
name: deploy-pages
description: Build and deploy to GitHub Pages (bootstrap, invite, restore, QR codes)
user-invocable: true
---

# Deploy GitHub Pages

Build all frontend apps and deploy to GitHub Pages via the `docs/` directory.

## Steps

### 1. Build all apps

Run from the repo root:

```bash
npm run build              # wallet + invite + dashboard
npm run build:restore      # restore app
```

### 2. Deploy to docs/

```bash
npm run deploy:pages
```

This copies bootstrap files to `docs/`, generates QR codes for all locales.

### 3. Check for changes

```bash
git status docs/
```

If there are changes in `docs/`, show the diff summary and commit them.

### 4. Push

Ask the user which branch to push to. If on `develop`, the changes will go live when merged to `master` (GitHub Pages serves from `docs/` on `master`). If the user wants it live immediately, ask if they want to merge to master now.
