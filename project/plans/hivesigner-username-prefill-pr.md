# HiveSigner PR Plan: Pre-fill username via query parameter

## Goal

Add `username` query parameter support to HiveSigner's OAuth flow so that onboarding apps (like the Propolis invite app) can pre-fill the username field when redirecting new users to import their account. This eliminates one manual step in the multi-step login flow.

**Target repo:** `ecency/hivesigner-ui` (branch: `development`)
**Framework:** Nuxt.js 2 + Vue 2 + TypeScript (class-style components with `nuxt-property-decorator`)
**State management:** Vuex via `PersistentFormsModule`

## Background

When a brand-new Hive user is redirected to HiveSigner via OAuth, the flow is:

1. `/oauth2/authorize?client_id=peakd.app&redirect_uri=...&scope=login` — thin redirect page
2. → `/login` — but middleware detects no imported accounts
3. → `/import` — user must type username + paste posting key + set encryption password
4. → `/login` — select account from dropdown
5. → `/authorize/peakd.app` — grant posting authority (if scope=posting)
6. → redirect back to peakd.com

The `username` parameter will pre-fill the username input on the `/import` page (step 3), saving the user from typing it. The calling app copies the posting key to the clipboard beforehand, so the user only needs to paste one field.

## Security constraints

1. **Pre-fill only.** The `username` param must only set the form input value. It must never bypass authentication, auto-submit forms, or skip any step.
2. **No keys in URLs.** Keys must never appear in query parameters (they leak via server logs, browser history, referrer headers). The posting key is passed via clipboard by the calling app.
3. **Input sanitization.** Validate the `username` param against Hive username rules before inserting into the DOM: lowercase `[a-z0-9.-]`, 3–16 chars, starts with a letter. Drop the param silently if invalid.
4. **No change to redirect_uri validation.** The existing `redirect_uris` check in `loadAppProfile()` must remain untouched.
5. **No change to authentication logic.** The `AccountsModule.isValidCredentials()` and `AuthModule.login()` calls remain exactly as they are.

## Files to modify (3 files)

### 1. `src/pages/import.vue`

This is the main change. The import page needs to read `username` from the query string and pre-fill the Vuex-backed username field.

**In the `mounted()` method** (currently line 230), add username pre-fill logic at the end of the method:

```typescript
// After the existing mounted() logic (line 257), add:

// Pre-fill username from query parameter (used by onboarding apps)
const qsUsername = (this.$route.query.username as string || '').toLowerCase().trim()
if (qsUsername && /^[a-z][a-z0-9.-]{2,15}$/.test(qsUsername) && !this.username) {
  this.username = qsUsername
}
```

Key details:
- The `this.username` setter calls `PersistentFormsModule.saveImportUsername(value)`, which is the same Vuex store that `ImportUserForm.vue` reads from. So setting it here will populate the form field.
- The `!this.username` guard ensures we don't overwrite if the user already has a username in progress (e.g. if they navigated back).
- The regex validates Hive username rules before inserting.
- `.toLowerCase().trim()` normalizes the input.

### 2. `src/middleware/before-login.ts`

This middleware redirects users without accounts from `/login` to `/import`. It already passes query params through, but we need to confirm `username` survives the redirect.

**Current code (line 29–31):**
```typescript
if (!store.getters['accounts/hasAccounts']) {
  redirect('/import', query)
}
```

This already spreads the full `query` object to `/import`, so the `username` param from the original OAuth URL will naturally flow through. **No changes are strictly needed here.**

However, to be explicit and for safety, you could add the `username` param to the query object in the `/login-request` parsing block (lines 6–26). Currently that block only copies params parsed from the redirect path. If someone uses the `/login-request/` entry point with `?username=foo`, it would already be in `query` from the initial spread, so this is already handled.

**Verdict: No changes needed to this file.** The existing code already passes all query params through to `/import`.

### 3. `src/pages/oauth2/authorize.vue`

Same situation — this page spreads `this.$route.query` into the query object and pushes to `/login`:

```typescript
const query: any = {
  ...this.$route.query
}
// ...
this.$router.push({ path: '/login', query })
```

The `username` param will pass through naturally. **No changes needed to this file.**

## Summary of actual code changes

Only **one file** needs modification: `src/pages/import.vue`.

Add these lines at the end of the `mounted()` method (after line 257, before the closing `}`):

```typescript
// Pre-fill username from query parameter (used by onboarding apps)
const qsUsername = (this.$route.query.username as string || '').toLowerCase().trim()
if (qsUsername && /^[a-z][a-z0-9.-]{2,15}$/.test(qsUsername) && !this.username) {
  this.username = qsUsername
}
```

That's it — approximately 4 lines of code.

## How the calling app uses this

The Propolis invite app's success screen would change from:

```typescript
// Current: user must manually copy username AND key, then navigate to HiveSigner
const hiveSignerUrl = `https://hivesigner.com/oauth2/authorize?client_id=peakd.app&redirect_uri=...&scope=login`;
```

To:

```typescript
// New: pre-fill username, copy posting key to clipboard before opening
await navigator.clipboard.writeText(postingKey);
const params = new URLSearchParams({
  client_id: 'peakd.app',
  redirect_uri: 'https://peakd.com/callback/hivesigner',
  scope: 'posting',
  response_type: 'code',
  state: '/',
  username: state.claimResult.account,  // <-- new parameter
});
window.open(`https://hivesigner.com/oauth2/authorize?${params}`, '_blank');
```

The user flow becomes:
1. Invite app copies posting key to clipboard
2. Opens HiveSigner with `&username=newuser`
3. User lands on `/import` with username pre-filled
4. User pastes posting key from clipboard → clicks Login
5. Done (HiveSigner handles the rest)

## Testing checklist

- [ ] Navigate to `/oauth2/authorize?client_id=peakd.app&redirect_uri=https://peakd.com/callback/hivesigner&scope=login&username=testuser123` with no imported accounts — should land on `/import` with "testuser123" pre-filled in the username field
- [ ] Same URL without `&username=` — username field should be empty (existing behavior unchanged)
- [ ] Invalid username in query (`&username=<script>alert(1)</script>`) — should be silently ignored, field stays empty
- [ ] Username with uppercase (`&username=TestUser`) — should be lowercased to "testuser"
- [ ] Username too short (`&username=ab`) — should be silently ignored
- [ ] User already has a username in progress, then navigates to URL with `&username=other` — should NOT overwrite the existing username
- [ ] Full OAuth flow with pre-filled username: enter posting key, complete import, verify redirect back to app works correctly
- [ ] Direct navigation to `/import?username=testuser123` (no OAuth context) — username should still pre-fill

## PR description template

```
## Summary

Add support for a `username` query parameter in the OAuth flow. When present,
the username field on the import page is pre-filled, reducing friction for
onboarding apps that already know the user's Hive username.

This is a UX convenience only — it does not affect authentication or
authorization logic. The parameter is validated against Hive username rules
and silently ignored if invalid.

## Motivation

Onboarding apps that create Hive accounts (e.g. gift card / invite systems)
already know the new user's username. Currently, users must manually type it
when importing their account on HiveSigner. Pre-filling this field eliminates
one step in the multi-step login flow.

## Changes

- `src/pages/import.vue`: Read `username` from query params in `mounted()`,
  validate against Hive username regex, and pre-fill the form field via
  `PersistentFormsModule.saveImportUsername()`.

## Security

- Parameter only pre-fills the input field; no authentication bypass
- Input validated with `/^[a-z][a-z0-9.-]{2,15}$/` before use
- No keys or sensitive data in URL parameters
- Existing `redirect_uri` validation unchanged
```
