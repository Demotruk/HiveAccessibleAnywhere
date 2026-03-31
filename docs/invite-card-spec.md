# Invite Card Claim Protocol Specification

**Version:** 1.0
**Date:** 2026-03-30
**Status:** Living document

This specification describes the protocol for consuming a Propolis invite card (QR code + PIN) to onboard a new user onto the Hive blockchain. It is intended for mobile app developers who want to implement a keyless onboarding flow.

---

## Table of Contents

1. [Overview](#overview)
2. [QR Code Format](#qr-code-format)
3. [PIN & Decryption](#pin--decryption)
4. [Decrypted Payload](#decrypted-payload)
5. [Card Verification](#card-verification)
6. [Username Selection](#username-selection)
7. [Key Generation](#key-generation)
8. [Account Claim API](#account-claim-api)
9. [Post-Claim: Key Backup](#post-claim-key-backup)
10. [Error Handling](#error-handling)
11. [Security Considerations](#security-considerations)
12. [Appendix: Compact Merkle Proof Format](#appendix-compact-merkle-proof-format)
13. [Appendix: Encryption Format Details](#appendix-encryption-format-details)
14. [Appendix: Hive Key Derivation](#appendix-hive-key-derivation)

---

## Overview

An invite card consists of two components:

- **QR code** — encodes a URL with an encrypted payload in the fragment
- **PIN** — 6-character alphanumeric code printed separately (e.g. on the back of a physical card)

Together, these allow a new user to create a Hive blockchain account without ever handling raw cryptographic keys during the onboarding flow. All keys are generated client-side and only public keys are transmitted to the claim service.

### High-Level Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Scan QR │ ──► │ Enter PIN│ ──► │ Verify   │ ──► │ Choose   │ ──► │  Claim   │
│          │     │ Decrypt  │     │ Card     │     │ Username │     │ Account  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

1. User scans QR code → app extracts encrypted blob from URL fragment
2. User enters PIN → app decrypts the payload
3. App verifies the card (expiry, provider signature)
4. User chooses a username → app checks on-chain availability
5. App generates keys locally, sends public keys + token to the claim service
6. Service creates the Hive account on-chain
7. App presents key backup to the user

---

## QR Code Format

The QR code encodes a URL of the form:

```
https://<host>/invite/#<encrypted-blob>
```

- **Host**: Currently `hiveinvite.com` but may vary per issuer.
- **Path**: `/invite/` (or any path — the consuming app only needs the fragment).
- **Fragment**: Everything after `#` is the encrypted blob.

> **Important**: The fragment (`#...`) is never sent to any server by browsers. This is a deliberate security property — the encrypted payload stays client-side.

### Detecting an Invite Card

A consuming app should:
1. Parse the scanned URL
2. Extract everything after `#` as the encrypted blob
3. Check if the blob starts with `c1:` (compressed format) or is raw base64url (legacy)

---

## PIN & Decryption

### PIN Format

- **Length**: 6 characters
- **Alphabet**: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 characters)
- **Excluded**: `0`, `1`, `I`, `O` (to avoid visual confusion with letters/digits)
- **Case**: Uppercase only. The app should normalize input to uppercase.

### Decryption Steps

1. **Strip prefix**: If the blob starts with `c1:`, remove that prefix (indicates compressed format). Otherwise, treat as legacy uncompressed.

2. **Base64url decode** the remaining string to raw bytes.

3. **Extract fields** from the byte array:
   | Offset | Length | Field |
   |--------|--------|-------|
   | 0 | 16 bytes | Salt |
   | 16 | 12 bytes | IV (initialization vector) |
   | 28 | 16 bytes | AES-GCM auth tag |
   | 44 | remainder | Ciphertext |

4. **Derive key** using PBKDF2:
   - Password: the 6-character PIN (UTF-8 encoded)
   - Salt: from step 3
   - Iterations: **100,000**
   - Hash: SHA-256
   - Output length: 32 bytes (256 bits)

5. **Decrypt** using AES-256-GCM:
   - Key: from step 4
   - IV: from step 3
   - Auth tag: from step 3
   - Ciphertext: from step 3

6. **Decompress** (if `c1:` prefix was present):
   - Apply inflate (raw deflate, no zlib/gzip header)
   - The result is a UTF-8 JSON string

7. **Parse JSON** and expand short keys (see next section).

If decryption fails (wrong PIN), the AES-GCM auth tag check will fail. Present a "wrong PIN" error.

---

## Decrypted Payload

The JSON payload uses short single-letter keys for size optimization. Expand them as follows:

| Short Key | Full Name | Type | Required | Description |
|-----------|-----------|------|----------|-------------|
| `t` | `token` | string | Yes | 64-character hex token (single-use claim credential) |
| `p` | `provider` | string | Yes | Hive account name of the card issuer |
| `s` | `serviceUrl` | string | Yes | Base URL of the gift card claim service |
| `e` | `endpoints` | string[] | No | Hive API proxy endpoints (for robust variant) |
| `b` | `batchId` | string | Yes | Batch identifier for this card |
| `x` | `expires` | string | Yes | ISO 8601 expiry timestamp |
| `g` | `signature` | string | Yes | ECDSA signature (hex) over canonical message |
| `y` | `promiseType` | string | Yes | What the card promises (e.g. `account-creation`) |
| `a` | `promiseParams` | object | No | Type-specific parameters (e.g. delegation amount) |
| `m` | `merkleProof` | string | No | Compact-encoded Merkle inclusion proof |
| `v` | `variant` | string | Yes | `standard` or `robust` |
| `l` | `locale` | string | No | Locale code for robust variant wallet fetch |

### Example Expanded Payload

```json
{
  "token": "a3f9e2c1d5b7a8e4f2c9d1b5a7e3f2c9d1b5a7e3f2c9d1b5a7e3f2c9d1b5a7e3",
  "provider": "some-issuer",
  "serviceUrl": "https://giftcard.example.com",
  "endpoints": ["https://proxy1.example.com", "https://proxy2.example.com"],
  "batchId": "batch-abc123-def456",
  "expires": "2027-03-30T00:00:00.000Z",
  "signature": "1f3a9b...(hex)...",
  "promiseType": "account-creation",
  "promiseParams": { "delegation_vests": "30000.000000 VESTS" },
  "merkleProof": "L1a2b3...R4c5d6...",
  "variant": "standard"
}
```

---

## Card Verification

Before presenting the username screen, verify the card's authenticity. These checks can run in parallel.

### 1. Check Expiry

```
if (now > new Date(payload.expires)) → card expired
```

### 2. Verify Provider Signature

The signature proves the card was issued by the claimed provider.

**Canonical message** (concatenated with colons):
```
{token}:{batchId}:{provider}:{expires}:{promiseType}
```

**Verification steps**:
1. Compute `SHA-256(canonical_message)` → 32-byte hash
2. Recover the public key from the ECDSA signature over that hash
3. Fetch the provider's Hive account via a Hive API call:
   - API: `condenser_api.get_accounts` with `[["<provider>"]]`
   - Extract: `result[0].memo_key` (the provider's memo public key)
4. Compare the recovered public key with the provider's on-chain `memo_key`
5. If they don't match → **counterfeit card**

**Hive API endpoints to use** (in priority order):
1. Proxy endpoints from `payload.endpoints` (if present)
2. Public Hive API nodes: `https://api.hive.blog`, `https://api.deathwing.me`, `https://anyx.io`

**Signature format**: The signature is a hex-encoded Hive-style recoverable ECDSA signature (65 bytes: 1 byte recovery flag + 32 bytes r + 32 bytes s). Use a Hive-compatible signature library for recovery.

### 3. Validate Promise Type

Currently supported: `account-creation`. If the `promiseType` is unrecognized, the app should inform the user that this card type is not supported by this version of the app.

---

## Username Selection

### Hive Username Rules

- **Length**: 3–16 characters
- **Allowed characters**: `a-z`, `0-9`, `.`, `-`
- **Must start with**: a letter (`a-z`)
- **Must end with**: a letter or digit (`a-z0-9`)
- **No consecutive separators**: `--`, `..`, `.-`, `-.` are all invalid
- **No trailing separators**: cannot end with `.` or `-`

### Regex Pattern

```regex
^[a-z][a-z0-9.-]{1,14}[a-z0-9]$
```

Plus the consecutive-separator check:
```regex
/[.-]{2}/  → reject if this matches
```

### Availability Check

Use the Hive API to check if a username is taken:

```json
POST to any Hive API node
{
  "jsonrpc": "2.0",
  "method": "condenser_api.get_accounts",
  "params": [["desired-username"]],
  "id": 1
}
```

- If `result` contains an account → username is **taken**
- If `result` is empty → username is **available**

Debounce checks (e.g. 500ms) to avoid excessive API calls during typing.

### Suggested Alternatives

If the user's first choice is taken, offer alternatives by appending digits or short suffixes:
- `username1`, `username2`, `username12`, `username123`
- Batch-check candidates with a single `get_accounts` call (accepts up to 1000 names)

---

## Key Generation

Keys are generated entirely client-side. The claim service never sees private keys.

### Master Password

Generate a random master password:
- **Format**: `P5` prefix + 48 random base58 characters = 50 characters total
- **Base58 alphabet**: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`

Example: `P5HqUkbbBF9UfxEz...` (50 chars)

### Derive Key Pairs

Using the standard Hive key derivation (`PrivateKey.fromLogin`), derive 4 key pairs:

```
For each role in [owner, active, posting, memo]:
  seed = username + role + masterPassword
  privateKey = SHA-256(seed)  →  interpret as secp256k1 private key
  publicKey  = derive secp256k1 public key from privateKey
```

**Output per role**:
- **Private key (WIF)**: Base58Check-encoded, starts with `5` (51 characters)
- **Public key**: Hive format, starts with `STM` followed by Base58Check-encoded point (53 characters)

### What to Send to the Claim Service

Only **public keys** are sent:

```json
{
  "owner": "STM...",
  "active": "STM...",
  "posting": "STM...",
  "memo": "STM..."
}
```

### Key Roles

| Role | Purpose | When Used |
|------|---------|-----------|
| **Owner** | Account recovery, changing other keys | Rarely (keep very safe) |
| **Active** | Transfers, power up/down, account updates | Financial transactions |
| **Posting** | Voting, commenting, following, custom_json | Daily social operations |
| **Memo** | Encrypting/decrypting private messages | Messaging |

---

## Account Claim API

### Pre-flight: Validate (Optional)

Warm up the service and optionally pre-validate the token.

```
POST {serviceUrl}/validate
Content-Type: application/json

{
  "token": "<token>"
}
```

**Response (200)**:
```json
{
  "valid": true,
  "expires": "2027-03-30T00:00:00.000Z",
  "promiseType": "account-creation"
}
```

**Response (400)**:
```json
{
  "valid": false,
  "reason": "Token expired"
}
```

This endpoint has no side effects. It can also be called with `{"token": "wake"}` purely to warm up the service (cold-start mitigation for serverless/Fly.io deployments).

### Claim Account

```
POST {serviceUrl}/claim
Content-Type: application/json

{
  "token": "<64-char-hex-token>",
  "username": "<chosen-username>",
  "keys": {
    "owner": "<STM-public-key>",
    "active": "<STM-public-key>",
    "posting": "<STM-public-key>",
    "memo": "<STM-public-key>"
  },
  "provider": "<provider-account>",
  "batchId": "<batch-id>",
  "signature": "<hex-signature>",
  "expires": "<iso-timestamp>",
  "promiseType": "account-creation",
  "promiseParams": { ... },
  "merkleProof": "<compact-encoded-proof>"
}
```

All fields from the decrypted payload are passed through, plus the user-chosen `username` and locally-generated `keys`.

**Response (200)**:
```json
{
  "success": true,
  "account": "chosen-username",
  "tx_id": "abc123def456789...",
  "method": "claimed"
}
```

- `method`: Either `"claimed"` (used a discounted account creation token) or `"paid"` (paid the full on-chain fee). This is informational only; the account is created either way.
- `tx_id`: The Hive blockchain transaction ID. Can be looked up on block explorers.

**Timeout**: Allow up to **60 seconds** for this request. Account creation involves an on-chain broadcast and block confirmation.

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/claim` | 10 requests | per minute per IP |
| `/validate` | 30 requests | per minute per IP |

Rate limit headers are returned:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

HTTP 429 is returned when rate-limited.

---

## Post-Claim: Key Backup

After a successful claim, the app **must** present the user with a way to back up their keys. Without this backup, account recovery is impossible.

### Recommended Approach

1. **Display the master password** and prompt the user to write it down or save it securely.
2. **Generate an encrypted backup QR code** containing all 4 WIF private keys, encrypted with the same PIN used during onboarding.
3. Prompt the user to screenshot or save the QR code.

### Encrypted Backup Format

The backup QR contains a JSON payload encrypted with the same PIN-based AES-256-GCM scheme described in [PIN & Decryption](#pin--decryption):

```json
{
  "account": "chosen-username",
  "keys": {
    "owner": "5J...",
    "active": "5J...",
    "posting": "5J...",
    "memo": "5J..."
  }
}
```

This backup can be restored using the companion restore app or any app implementing this spec's decryption logic.

### What the User Ends Up With

After completing the flow, the user has:

- A **Hive blockchain account** (fully created on-chain)
- A **master password** (from which all keys can be re-derived given the username)
- **4 private keys** (owner, active, posting, memo) in WIF format
- An optional **encrypted QR backup** (restorable with PIN)
- The **PIN** (needed to decrypt the backup QR if they saved one)

---

## Error Handling

### Claim Error Responses

All errors return `{ "success": false, "error": "<message>" }`.

| HTTP Status | Error | Meaning |
|-------------|-------|---------|
| 400 | `Missing required field: token` | Incomplete request body |
| 400 | `Invalid token` / `Token not found` | Token doesn't exist or is malformed |
| 400 | `Token already redeemed` | Token was already used (single-use) |
| 400 | `Token expired` | Card has passed its expiry date |
| 400 | `Username already taken` | Another account claimed this name |
| 400 | `All four public keys required` | Missing one or more public keys |
| 400 | `Invalid token proof` | Merkle proof verification failed |
| 400 | `Invalid signature` | Signature doesn't match provider's memo key |
| 403 | `Provider not authorized` | Provider not in service's allowlist |
| 429 | (rate limit) | Too many requests |
| 500 | `Account creation failed` | On-chain broadcast error |
| 501 | `Promise type '...' is not yet supported` | Unrecognized promise type |

### Recovery Guidance

- **Wrong PIN**: Decryption fails locally (AES-GCM auth tag mismatch). Let the user retry.
- **Expired card**: Nothing can be done. Inform the user.
- **Token already redeemed**: Card was used. Inform the user to contact the issuer.
- **Username taken**: Let the user choose a different name.
- **Network errors**: Retry with exponential backoff. Try alternative Hive API nodes.

---

## Security Considerations

### Client-Side Security

- **Clear the URL fragment** from memory/history immediately after extracting it, to prevent leakage through browser history or logs.
- **Never transmit private keys** to any server. Only public keys go to the claim service.
- **Validate the PIN format** before attempting decryption (6 chars, uppercase alphanumeric from the allowed set).
- **PBKDF2 with 100,000 iterations** provides brute-force resistance. Even with the QR code, an attacker must crack the PIN (~31 bits of entropy — feasible for a determined attacker, so the QR should be treated as sensitive).

### Network Security

- All communication with the claim service and Hive API nodes **must** use HTTPS.
- The claim service has CORS enabled (`Access-Control-Allow-Origin: *`), so browser-based and native apps can call it directly.
- The `token` is the single-use credential. Once claimed, it cannot be reused.

### Trust Model

- The **card issuer** (provider) is trusted to have funded account creation.
- The **claim service** is trusted to broadcast the account creation transaction honestly.
- The **user's device** is trusted to generate and store keys securely.
- **No server ever sees the PIN or private keys.**

---

## Appendix: Compact Merkle Proof Format

The `merkleProof` field uses a compact string encoding:

```
[L|R]<64-char-hex-hash>[L|R]<64-char-hex-hash>...
```

Each step is exactly 65 characters:
- 1 character: `L` (sibling is on the left) or `R` (sibling is on the right)
- 64 characters: SHA-256 hash of the sibling node (hex-encoded)

### Verification Algorithm

```
currentHash = SHA-256(token)

for each step in proof:
  if step.position == 'left':
    currentHash = SHA-256(step.hash + currentHash)
  else:
    currentHash = SHA-256(currentHash + step.hash)

assert currentHash == expectedMerkleRoot
```

The expected Merkle root can be verified by looking up the batch declaration on-chain (a `custom_json` operation posted by the provider account containing `batch_id` and `merkle_root`).

> **Note**: Merkle proof verification is performed server-side during the `/claim` call. Client-side verification is optional but recommended for additional assurance.

---

## Appendix: Encryption Format Details

### Encrypted Blob Structure

For `c1:` (compressed) format:

```
"c1:" + base64url( salt[16] || iv[12] || authTag[16] || ciphertext[...] )
```

| Component | Size | Description |
|-----------|------|-------------|
| Salt | 16 bytes | Random, used for PBKDF2 key derivation |
| IV | 12 bytes | Random, used for AES-GCM |
| Auth Tag | 16 bytes | AES-GCM authentication tag |
| Ciphertext | variable | Encrypted compressed JSON |

### Key Derivation

```
key = PBKDF2-SHA256(
  password = PIN (UTF-8),
  salt     = salt (16 bytes from blob),
  iterations = 100000,
  keyLength  = 32 bytes
)
```

### Decryption

```
plaintext = AES-256-GCM-Decrypt(
  key     = derived key,
  iv      = iv (12 bytes from blob),
  authTag = authTag (16 bytes from blob),
  data    = ciphertext
)
```

### Decompression

For `c1:` blobs: `JSON.parse(inflate(plaintext))` — use raw deflate (no zlib/gzip header, i.e. `wbits = -15` in most libraries).

For legacy blobs (no `c1:` prefix): `JSON.parse(plaintext)` — no decompression needed.

### Base64url

Standard Base64 with `+` → `-`, `/` → `_`, no padding (`=`).

---

## Appendix: Hive Key Derivation

This is the standard Hive key derivation used by all Hive wallets and libraries.

### From Master Password to Private Key

```
seed = username + role + masterPassword
  where role ∈ {"owner", "active", "posting", "memo"}

privateKeyBytes = SHA-256(seed)

// If the resulting bytes are not a valid secp256k1 private key
// (i.e., >= curve order), hash again. This is extremely rare.

privateKey = secp256k1.PrivateKey(privateKeyBytes)
```

### WIF (Wallet Import Format)

```
payload = 0x80 || privateKeyBytes (33 bytes total)
checksum = SHA-256(SHA-256(payload))[0:4]
wif = Base58Encode(payload || checksum)
```

Result: 51-character string starting with `5`.

### Public Key (Hive Format)

```
publicPoint = secp256k1.publicKey(privateKey, compressed=true)  // 33 bytes
checksum = RIPEMD-160(publicPoint)[0:4]
publicKey = "STM" + Base58Encode(publicPoint || checksum)
```

Result: 53-character string starting with `STM`.

### Master Password Format

```
"P5" + 48 random characters from Base58 alphabet
= 50 characters total
```

Base58 alphabet: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`

### Reference Libraries

- **JavaScript/TypeScript**: [hive-tx](https://www.npmjs.com/package/hive-tx) — `PrivateKey.fromLogin(username, password, role)`
- **Python**: [beem](https://github.com/holgern/beem) — `PasswordKey(username, password, role)`
- **Java/Kotlin**: [dhive](https://github.com/openhive-network/dhive) or manual secp256k1
- **Swift**: Manual secp256k1 with CommonCrypto for SHA-256
- **Rust**: [hive-keychain-sdk](https://crates.io/crates/hive-keychain) or manual implementation

---

## Appendix: Account Created On-Chain

For reference, here is what the claim service creates on the Hive blockchain:

### Account Authorities

```json
{
  "owner": {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [["<owner-public-key>", 1]]
  },
  "active": {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [["<active-public-key>", 1]]
  },
  "posting": {
    "weight_threshold": 1,
    "account_auths": [["peakd.app", 1]],
    "key_auths": [["<posting-public-key>", 1]]
  },
  "memo_key": "<memo-public-key>"
}
```

Note: `peakd.app` is pre-authorized for posting operations (allows HiveSigner OAuth without needing the active key for social actions).

### Account Metadata

```json
{
  "created_by": "propolis-giftcard",
  "giftcard_token_hash": "<SHA-256 of token>"
}
```

### HP Delegation

The service delegates Hive Power (as VESTS) to the new account so it has enough Resource Credits to transact immediately. The default delegation is `30000.000000 VESTS` (~15 HP) but may vary per batch via `promiseParams.delegation_vests`.

### Feed Enrollment

A `0.001 HBD` transfer is sent from the provider to the HAA service account with the new username in the memo, enrolling the account in the feed/discovery system.
