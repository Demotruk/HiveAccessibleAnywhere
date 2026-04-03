# Pre-Release Checklist

Manual test checklist to run before each production deployment. Use the local test environment (`haa-local`) unless noted otherwise.

## Setup

1. Run `npx tsx scripts/setup-haa-local.ts` from repo root
2. Ensure `.env` has all required values (provider keys, JWT secret, posting key, invite base URL with LAN IP)
3. Start all services: `.\start-all.ps1`
4. Verify giftcard service: `https://localhost:3200/health`
5. Open dashboard: `http://localhost:5179/dashboard/`

---

## Dashboard

### Authentication
- [ ] Login with Hive Keychain succeeds
- [ ] Cancel Keychain popup — spinner clears (within 60s), no error shown
- [ ] Incorrect username — shows error
- [ ] Logout and re-login works

### Batch Generation
- [ ] Generate a batch with all options set (auto-follow, communities, referrer, custom expiry, note)
- [ ] Number and expiry fields can be edited without values snapping back
- [ ] PDF download works and contains QR codes + PINs
- [ ] Manifest download works and contains invite URLs

### Batch List & Detail
- [ ] Batch list shows all generated batches
- [ ] Batch detail shows per-card status
- [ ] Status updates after a card is claimed

---

## Invite Flow (Phone)

### Standard Variant
- [ ] Scan QR code on phone, invite app loads
- [ ] PIN entry succeeds
- [ ] Token verification passes
- [ ] Username selection — availability check works
- [ ] Key backup screen shows master password and QR
- [ ] Account creation succeeds
- [ ] PeakLock handoff to peakd.com works

### Post-Creation (verify on-chain)
- [ ] Account exists on chain
- [ ] Auto-follow applied (check `get_following`)
- [ ] Community subscription applied (check `list_all_subscriptions`)
- [ ] Referrer in `json_metadata` beneficiaries
- [ ] HP delegation applied

### Error Cases
- [ ] Double-spend: re-scan a claimed card — shows "token already redeemed"
- [ ] Invalid PIN — shows error, allows retry
- [ ] Username taken — shows error, allows picking another

---

## Restore App
- [ ] Scan backup QR from key backup screen
- [ ] Keys are correctly recovered and displayed

---

## Multi-Tenant (when applicable)

### Setup
- [ ] Service account configured (`GIFTCARD_SERVICE_ACCOUNT`, `GIFTCARD_SERVICE_ACTIVE_KEY`)
- [ ] Provider has delegated active authority to service account on-chain
- [ ] Provider is in `GIFTCARD_ALLOWED_PROVIDERS`

### Functionality
- [ ] Provider can log in to dashboard
- [ ] Batch generation works (declaration on provider's account)
- [ ] Claim creates account using service account's key
- [ ] Auto-follow/subscribe works (service account's posting key)
- [ ] Non-allowed provider is rejected

---

## Production Deployment

- [ ] All above tests pass on local
- [ ] `fly deploy` succeeds
- [ ] Health check passes: `https://<app>.fly.dev/health`
- [ ] Smoke test: generate 1-card batch, claim it, verify on-chain

---

## On-Chain Verification Commands

```bash
# Check account exists and metadata
curl -s -X POST https://api.hive.blog -d '{"jsonrpc":"2.0","method":"condenser_api.get_accounts","params":[["USERNAME"]],"id":1}' | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')).result[0]; console.log('Created:', r.created); console.log('Metadata:', r.json_metadata)"

# Check follows
curl -s -X POST https://api.hive.blog -d '{"jsonrpc":"2.0","method":"condenser_api.get_following","params":["USERNAME","",null,100],"id":1}' | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')).result; console.log('Following:', r.map(f=>f.following).join(', ') || '(none)')"

# Check community subscriptions
curl -s -X POST https://api.hive.blog -d '{"jsonrpc":"2.0","method":"bridge.list_all_subscriptions","params":{"account":"USERNAME"},"id":1}' | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')).result; console.log('Subscriptions:', r?.map(s=>s[0]).join(', ') || '(none)')"
```
