# Security Review — HiveAccessibleAnywhere / Propolis

**Date:** 2026-03-08
**Scope:** Full codebase — wallet, invite app, gift card service, proxy, scripts, on-chain distribution
**Reviewer:** Claude (automated)

---

## Overall Assessment

**Risk level: MODERATE** — The project demonstrates strong security fundamentals with specific areas needing attention as it matures toward production.

**Strengths:** Parameterized SQL queries, proper HTML escaping, SHA-256 integrity verification for on-chain distribution, minimal dependency footprint, lockfiles for reproducible builds, RPC method allowlisting, and correct use of standard cryptographic primitives (AES-256-GCM, PBKDF2, ECDSA/secp256k1, Web Crypto API).

---

## Findings

### HIGH-1: Bootstrap HTML is the Root of Trust

**Location:** `scripts/distribute-onchain.ts` (bootstrap generation)
**Component:** On-chain distribution

The on-chain wallet distribution uses SHA-256 hashes to verify chunk integrity. The root `VERSION_HASH` is embedded directly in the bootstrap HTML. If an attacker can tamper with the bootstrap HTML itself (e.g., compromised distribution channel, MITM on GitHub Pages download), they can embed a `VERSION_HASH` matching a malicious wallet, bypassing all on-chain integrity verification.

**Current mitigations:**
- Bootstrap served over HTTPS from GitHub Pages
- QR codes link to the official GitHub Pages URL

**Recommendation:** Consider publishing the `VERSION_HASH` via an independent channel (e.g., a signed Hive post from a known account, DNS TXT record) so users can cross-verify bootstrap integrity.

---

### HIGH-2: Service Account Compromise Enables Traffic Redirect

**Location:** `wallet/src/discovery/endpoint-feed.ts`
**Component:** Wallet endpoint discovery

The wallet discovers proxy endpoints by decrypting memos from the `haa-service` account. If this account's private key is leaked, an attacker can send encrypted endpoint memos redirecting all wallet users to a malicious RPC proxy, observing all wallet operations (account names, transaction history, balance queries). No key rotation or revocation mechanism currently exists.

**Current mitigations:**
- Memo decryption requires the user's private memo key
- Endpoint memos have expiration timestamps

**Recommendation:** Document a key rotation procedure. Implement multi-account service key support so a compromised key can be deprecated. Consider the alerting system mentioned in project requirements.

---

### HIGH-3: Private Keys Stored in Plaintext localStorage (Opt-in)

**Location:** `wallet/src/ui/app.ts` (state persistence), `wallet/src/ui/components/login.ts:200`
**Component:** Wallet

When the user checks "Remember keys", active and memo WIF keys are stored as plaintext JSON in `localStorage`. Any XSS vulnerability (even in a future version) could exfiltrate these keys. The `localStorage` is also accessible to browser extensions and persists across sessions.

**Current mitigations:**
- Opt-in only; defaults to `sessionStorage` (session-only)
- Warning shown: "Keys stored in localStorage. Only use on a trusted device."
- Single-file HTML with no external script injection surface

**Recommendation:** Consider encrypting stored keys with a user-chosen PIN before persisting. Alternatively, limit persistence to `sessionStorage` only.

---

### MED-1: OAuth State Parameter is Hardcoded

**Location:** `invite/src/ui/screens/success.ts:24`
**Component:** Invite app

```typescript
state: '/',  // Hardcoded — no CSRF nonce
```

The HiveSigner OAuth URL uses a hardcoded `state` parameter. No PKCE is implemented. In a standard OAuth flow, this would be a CSRF vulnerability.

**Mitigating context:** The invite app does not handle the OAuth callback — it merely opens a link for the user to log into peakd.com via HiveSigner. The redirect goes to `https://peakd.com/callback/hivesigner`, not back to the invite app. This limits the practical CSRF risk since there is no callback to forge. However, an attacker could theoretically trick a user into authorizing a different HiveSigner session.

**Recommendation:** Generate a random `state` value per authorization request if the flow is ever extended to handle callbacks.

---

### MED-2: `Math.random()` for Obfuscation Path Selection

**Location:** `wallet/src/obfuscation/codec.ts:53`
**Component:** Wallet traffic obfuscation

```typescript
path: PATHS[Math.floor(Math.random() * PATHS.length)],
```

Uses `Math.random()` to select from 4 obfuscation endpoint paths. While not a cryptographic operation, in a censorship-evasion context predictable path selection could aid traffic fingerprinting. The same file already uses `crypto.getRandomValues()` for the session ID (line 16).

**Recommendation:** Replace with `crypto.getRandomValues()` for consistency. This is a one-line fix.

---

### MED-3: Obfuscation Protocol is Encoding, Not Encryption

**Location:** `wallet/src/obfuscation/codec.ts`, `proxy/src/deobfuscate.ts`
**Component:** Wallet/Proxy

The traffic "obfuscation" protocol is `Base64(gzip(JSON-RPC))` with a distinguishing `X-Api-Version: 1` header. This is trivially reversible by any network observer and the header makes it fingerprintable. No HMAC or integrity check protects the obfuscated payload.

**Current mitigations:**
- Random path selection from 4 REST-like endpoints
- Random session ID adds noise
- HTTPS transport protects content from passive observers

**Recommendation:** If real censorship resistance is needed, implement actual encryption (e.g., AES-256-GCM over the payload) and remove the distinguishing header. For a proof-of-concept, the current approach is acceptable.

---

### MED-4: No HTTPS Enforcement for User-Entered Proxy URLs

**Location:** `wallet/src/ui/components/login.ts:92,182`
**Component:** Wallet

Users can manually enter proxy endpoint URLs. The code validates URL format with `new URL()` but does not enforce the `https://` protocol. A user could enter an `http://` endpoint, causing keys and transactions to transit over plaintext.

```typescript
try { new URL(url); } catch { /* show error */ }
// No protocol check
```

**Recommendation:** Reject non-HTTPS URLs (except `localhost`/`127.0.0.1` for development).

---

### MED-5: Health Endpoint Exposes Service Metadata

**Location:** `giftcard/src/server.ts:79-85`, `proxy/src/server.ts:77-84`
**Component:** Gift card service, Proxy

Health endpoints return service identity, provider account name, cover site theme, and (on the proxy) the full list of allowed RPC methods.

```typescript
res.json({ status: 'ok', service: 'haa-giftcard', provider: config.providerAccount, theme: getThemeName() });
```

**Recommendation:** Consider restricting health endpoints to internal networks or removing the provider account name from the response.

---

### MED-6: Missing HTTP Security Headers

**Location:** `proxy/src/server.ts:33-40`, `giftcard/src/server.ts:39-46`
**Component:** Proxy, Gift card service

While `helmet` is used, the configuration is relaxed:
- CSP allows `'unsafe-inline'` for styles (needed for cover site)
- No explicit `Strict-Transport-Security` header (HSTS) — Helmet enables it by default but only when served over HTTPS
- Wide CORS (`Access-Control-Allow-Origin: *`) is intentional for decentralized wallet access

**Recommendation:** Explicitly enable HSTS when deploying behind TLS on Fly.io. The wide CORS is acceptable given the method allowlist and rate limiting.

---

### LOW-1: Token Status Oracle on Validate Endpoint

**Location:** `giftcard/src/routes/validate.ts:23-43`
**Component:** Gift card service

The `/validate` endpoint returns specific reasons for invalid tokens: "Token not found", "Token already redeemed", "Token revoked", "Token expired". This allows an attacker to enumerate token status.

**Mitigating context:** Tokens are 256-bit random values (32 bytes from `crypto.randomBytes`), making brute-force enumeration computationally infeasible. Rate limiting (30 req/min) further restricts attempts.

**Recommendation:** Acceptable for a PoC. For production, consider returning a generic "Invalid token" for all failure cases.

---

### LOW-2: Token Fragment in Audit Logs

**Location:** `giftcard/src/routes/claim.ts:56,75,137,151`
**Component:** Gift card service

Logs include the first 8 characters of claim tokens (e.g., `Token: abc12345...`). While truncated, this partial information could theoretically narrow a brute-force search space.

**Mitigating context:** 8 hex characters = 32 bits of the token revealed. Combined with 256-bit token entropy, this leaves 224 bits unknown — still computationally infeasible.

**Recommendation:** Acceptable. Consider logging only a token hash or sequence number instead if the service moves to centralized logging.

---

### LOW-3: In-Memory Rate Limiting

**Location:** `giftcard/src/middleware/rate-limit.ts`, `proxy/src/middleware/rate-limit.ts`
**Component:** Gift card service, Proxy

Rate limiting uses an in-memory `Map`, which resets on server restart and does not work across multiple instances. The code itself notes: "For production, replace with Redis-backed rate limiting."

**Recommendation:** Acceptable for a single-instance PoC. Replace with Redis or similar for multi-instance production deployments.

---

### LOW-4: No Explicit Key Zeroing in JavaScript

**Component:** Wallet, Invite app

Private keys in JavaScript memory are never explicitly overwritten with zeros after use. JavaScript provides no secure memory zeroing API, so keys remain in memory until garbage collected.

**Recommendation:** This is a known limitation of browser-based crypto applications. No action required — document in threat model.

---

### LOW-5: PIN Entropy (~30 bits)

**Location:** `giftcard/src/crypto/signing.ts`
**Component:** Gift card service

Gift card PINs are 6 characters from a 31-character alphabet (excluding confusable characters), yielding ~30 bits of entropy. PBKDF2 with 100,000 iterations mitigates brute-force but dedicated hardware could still crack a PIN.

**Current mitigations:**
- 100,000 PBKDF2-SHA256 iterations
- 16-byte random salt per encryption
- AES-256-GCM authenticated encryption

**Recommendation:** Acceptable tradeoff for user-memorizable PINs. Document that PINs protect convenience, not high-value secrets.

---

### LOW-6: Stale Cache Fallback in Bootstrap

**Location:** `scripts/distribute-onchain.ts` (bootstrap template)
**Component:** On-chain distribution

If all RPC endpoints are unreachable, the bootstrap loads a cached wallet from IndexedDB with only a "may be outdated" warning. No cache expiry is enforced.

**Recommendation:** Add a cache timestamp and warn more prominently (or refuse to load) if the cache is older than a configurable threshold.

---

### INFO-1: Wide CORS is Intentional

**Location:** `proxy/src/server.ts:44`, `giftcard/src/server.ts:50`

Both servers use `Access-Control-Allow-Origin: *`. This is by design — the wallet is a self-contained HTML file that may be opened from any origin (local file, GitHub Pages, on-chain bootstrap). The RPC method allowlist (7 methods) and rate limiting provide the access control boundary instead.

---

### INFO-2: `.env` File Properly Gitignored

The `scripts/.env` file containing private keys for test/dev accounts is listed in `.gitignore` and confirmed excluded from version control via `git ls-files`. Production deployments use Fly.io secrets.

---

### INFO-3: Dependency Supply Chain

The project has a minimal dependency footprint:
- **Wallet:** 2 direct dependencies (hive-tx, qr-scanner)
- **Invite:** 2 direct dependencies (hive-tx, qrcode)
- **Proxy:** 3 direct dependencies (express, helmet, tsx)
- **Gift card:** 5 direct dependencies (better-sqlite3, express, helmet, hive-tx, tsx)

All sub-projects have `package-lock.json` for reproducible builds. No postinstall lifecycle hooks detected. Cryptographic operations use `@noble/` libraries (audited, well-regarded) and Web Crypto API.

---

### INFO-4: SQL Injection — No Risk

**Location:** `giftcard/src/db.ts`

All database queries use parameterized statements via `better-sqlite3`'s `prepare()` API. No string concatenation of user input into SQL.

---

### INFO-5: XSS / DOM Injection — Well Handled

All `innerHTML` assignments use controlled template literals with localized strings or validated application state. RPC error messages are escaped via a dedicated `esc()` function (`wallet/src/hive/errors.ts`) that converts `& < > "` to HTML entities. No `eval()`, `Function()`, `document.write()`, or dynamic script injection detected in production code.

---

## Summary Table

| ID | Severity | Component | Finding | PoC Blocker? |
|----|----------|-----------|---------|--------------|
| HIGH-1 | High | Distribution | Bootstrap HTML is root of trust | No |
| HIGH-2 | High | Wallet | Service account compromise → traffic redirect | No |
| HIGH-3 | High | Wallet | Plaintext keys in localStorage (opt-in) | No |
| MED-1 | Medium | Invite | Hardcoded OAuth state parameter | No |
| MED-2 | Medium | Wallet | `Math.random()` in obfuscation codec | No |
| MED-3 | Medium | Wallet/Proxy | Obfuscation is encoding, not encryption | No |
| MED-4 | Medium | Wallet | No HTTPS enforcement for proxy URLs | No |
| MED-5 | Medium | Giftcard/Proxy | Health endpoint leaks metadata | No |
| MED-6 | Medium | Proxy/Giftcard | Missing HSTS header | No |
| LOW-1 | Low | Giftcard | Token status oracle on /validate | No |
| LOW-2 | Low | Giftcard | Token fragment in logs | No |
| LOW-3 | Low | Giftcard/Proxy | In-memory rate limiting | No |
| LOW-4 | Low | Wallet/Invite | No key zeroing in JS | No |
| LOW-5 | Low | Giftcard | PIN entropy ~30 bits | No |
| LOW-6 | Low | Distribution | Stale cache fallback | No |

---

## Recommendations by Priority

### Quick wins (minimal effort, good hygiene)
1. **MED-2:** Replace `Math.random()` with `crypto.getRandomValues()` in `codec.ts:53`
2. **MED-4:** Reject `http://` proxy URLs in `login.ts` (except localhost)
3. **MED-5:** Remove provider account name from health endpoint response

### Before production release
4. **HIGH-2:** Document service account key rotation procedure; implement multi-account support
5. **LOW-1:** Return generic "Invalid token" on `/validate` failures
6. **MED-6:** Explicitly enable HSTS on Fly.io deployments
7. **LOW-3:** Replace in-memory rate limiter with Redis-backed solution

### Architectural improvements (longer-term)
8. **HIGH-1:** Publish VERSION_HASH via independent verification channel
9. **HIGH-3:** Encrypt localStorage keys with user PIN or limit to sessionStorage
10. **MED-3:** Upgrade obfuscation protocol to use actual encryption if censorship resistance is a real requirement
