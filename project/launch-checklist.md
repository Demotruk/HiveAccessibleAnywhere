# HiveInvite.com Multi-Tenant Release Checklist

Track progress toward announcing and releasing the updated HiveInvite.com with multi-tenant Hive Invite services.

## Infrastructure / Deployment

- [x] Deploy giftcard service to Fly.io in multi-tenant mode (all required env vars configured)
- [x] Deploy key-monitor to Fly.io with `WATCH_ACCOUNTS` configured and Telegram alerts enabled
- [x] Build and deploy hiveinvite.com (landing + invite + restore + dashboard) to GitHub Pages
- [x] Verify DNS/HTTPS and CNAME for hiveinvite.com

## Docker Distribution

- [x] Publish giftcard service as a Docker image (`ghcr.io/demotruk/hive-invite-service`)
- [x] Publish key-monitor as a Docker image (`ghcr.io/demotruk/hive-key-monitor`)
- [x] Add GitHub Actions workflow to auto-build and push images on tagged releases
- [x] Document configuration (env vars, setup) in each package's README
- [x] Tag first releases to trigger image publishing (`giftcard-v1.0.0`, `key-monitor-v1.0.0`)

## End-to-End Testing

- [x] Full claim flow (standard variant) — generate test batch, scan QR / enter PIN, create account, verify on-chain
- [x] Dashboard issuer lifecycle — apply → admin approve → delegate active key via Keychain → auto-activation → generate batch → download PDF
- [x] Dashboard external service URL path — register self-hosted URL → verify status transitions to active
- [x] Batch signing via Keychain — prepare → Keychain sign → finalize, end-to-end in production dashboard
- [x] PDF generation — download combined PDF, verify QR codes scan correctly, PINs match
- [x] Invite app decryption — hiveinvite.com/invite/ correctly decrypts multi-tenant payloads
- [x] Restore app — hiveinvite.com/restore/ recovers keys from QR backup
- [x] Telegram operator notifications — alert fires when new issuer application is submitted
- [x] Key monitor alerts — unexpected operations on watched account trigger Telegram alerts

## Security

- [x] Key monitor operational before accepting any delegating issuers (hard blocker)
- [x] JWT secret set to a strong random value in production
- [x] Service account active key stored only in Fly.io secrets, not in repo
- [x] Allowed providers whitelist configured (no open registration without admin approval)
- [x] Rate limiting on /claim and /validate verified working

## Content / Announcement

- [x] Review landing page copy at hiveinvite.com
- [x] Draft Hive announcement post (what HiveInvite is, how issuers apply, what invitees get)
- [x] Decide initial issuers / launch partners and pre-approve if needed
- [x] Ensure service account has sufficient `create_claimed_account` tokens (2,081 on @demotruk)
- [x] Ensure sufficient HP delegated for Resource Credits on created accounts

## Known Limitations to Communicate

- Telegram/Discord bot distribution is single-tenant only (operator's cards); multi-provider bot support deferred
- Custom card designs deferred (v3) — only default "hive" design with issuer username
- Distributor authorization (letting issuers delegate distribution to third parties) deferred (v2)
- Robust variant (for blocked regions) available but separate from standard hiveinvite.com flow

## Post-Launch

- [ ] Monitor key-monitor for real operations and false alarms
- [ ] Monitor giftcard service logs for claim errors and batch generation issues
- [x] Verify dashboard JWT survives page refresh (sessionStorage)
- [ ] Document operator runbook (approve issuers, check token balance, add accounts to watch list)
