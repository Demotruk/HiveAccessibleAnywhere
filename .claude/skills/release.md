---
name: release
description: Full production release — build, deploy services, update pages, merge to master
user-invocable: true
---

# Full Release

Run the complete production release workflow. Pause at each manual step and wait for user confirmation before continuing.

## Steps

### 1. Pre-flight checks

- Run `git status` to ensure the working tree is clean
- Run `git log master..develop --oneline` to show what's being released
- Show the user the list of changes and ask them to confirm proceeding

### 2. Build all apps

Run these builds from the repo root:

```bash
npm run build              # wallet + invite + dashboard
npm run build:restore      # restore app
```

If any build fails, stop and report the error.

### 3. Set up live deployment workspace

Run from the repo root:

```bash
npx tsx scripts/setup-haa-live.ts
```

This copies the latest built code into the `../haa-live/` workspace. Do NOT read or access that directory — just run the setup script.

### 4. Deploy giftcard service (MANUAL)

Ask the user to run the following from their `haa-live` directory:

```
.\deploy.ps1
```

Wait for them to confirm it succeeded. Ask them to verify the health check:

```
https://<app>.fly.dev/health
```

### 5. Deploy dashboard (MANUAL)

Ask the user to run the following from their `haa-live` directory:

```
.\deploy-dashboard.ps1
```

Wait for them to confirm it succeeded.

### 6. Deploy GitHub Pages

Run from the repo root:

```bash
npm run deploy:pages
```

Then check if there are changes in `docs/`:

```bash
git status docs/
```

If there are changes, commit them to the current branch (`develop`).

### 7. Deploy HiveInvite.com (MANUAL)

Ask the user if HiveInvite.com needs updating (dashboard or invite/restore changed). If yes, ask them to push the hiveinvite.com repo.

### 8. Deploy bot (CONDITIONAL)

Ask the user if the telegram/discord bot needs deploying. If yes, ask them to run from `haa-live`:

```
.\deploy-bot.ps1
```

Wait for confirmation.

### 9. On-chain publishing (CONDITIONAL)

Ask the user if the wallet needs on-chain republishing (only if wallet code changed). If yes:

1. Build all wallet locales: `cd wallet && npm run build:all`
2. Ask user to run distribute-onchain and publish-bootstrap from `haa-live` (these need posting keys)

### 10. Merge to master

**Always ask for explicit permission before merging.**

If approved:

```bash
git checkout master
git merge develop
git push origin master
```

Then switch back to develop:

```bash
git checkout develop
```

### 11. Tag release (OPTIONAL)

Ask the user if they want to tag the release. If yes, ask for the tag name (suggest format like `giftcard-vX.Y.Z` for docker image builds, or a general `vX.Y.Z`).

```bash
git tag <tag-name>
git push origin <tag-name>
```

### 12. Done

Summarize what was deployed.
