# Onboarding Flow: Profile Setup & Introduction Post

**Status:** Draft — in discussion
**Branch:** TBD (new feature branch)

## Overview

Extend the standard gift card invite flow with two new steps after account creation and before the peakd.com handoff: profile setup and a first "introduceyourself" post. The new flow is **backwards compatible** — the existing direct-to-peakd.com path remains available for cards that don't opt into the extended flow.

## Current Flow (unchanged)

1. PIN entry — decrypt gift card payload
2. Card verification — signature + expiry check
3. Username selection — availability check on-chain
4. Key backup — master password generation + QR backup
5. Account claim — service creates account on-chain
6. Success — redirect to `peakd.com/signin` (posting key auto-copied, user pastes into PeakLock)

## Extended Flow (new)

Steps 1–5 remain identical. Two new screens are inserted before the peakd.com handoff:

1. PIN entry
2. Card verification
3. Username selection
4. Key backup
5. Account claim
6. **Profile setup** _(new)_
7. **Introduction post** _(new)_
8. Success — redirect to peakd.com (same as before)

---

## Step 6: Profile Setup

After the account is created on-chain, the user sets up their profile before posting.

### Fields

| Field | Required | Notes |
|-------|----------|-------|
| Photo | Yes | Single image — used as both profile picture and the image in the introduction post |
| Display name | Yes | Free text, shown on profile |
| About / bio | Optional | Short description |
| Location | Optional | Free text |
| Website | Optional | URL |

### Photo Upload

A single image captured in this step serves double duty:

1. **Profile picture** — set via `account_update2` in `posting_json_metadata.profile.profile_image`
2. **Introduction post image** — embedded as markdown in the post body (step 7)

**Image hosting:** Upload to the public Hive image hosting API (`images.hive.blog`).

- **Endpoint:** `POST /<username>/<signature>`
- **Authentication:** SHA256 hash of `'ImageSigningChallenge' + imageData`, signed with the user's posting key (already in memory).
- **Fallback:** If `images.hive.blog` rejects the upload (e.g. reputation threshold for fresh accounts), try `images.ecency.com` as a secondary host.
- **UI:** Mobile-friendly camera/photo capture. Single image only — keep it simple.

**Risk:** Fresh accounts start at reputation 25. The image hosting instances may enforce a minimum reputation threshold. This needs testing. If both public instances reject fresh accounts, we would need to proxy the upload through the giftcard service using an established account.

### Technical Details

- Broadcast an `account_update2` operation using the posting key (already in memory from key derivation).
- The posting key has authority to update profile metadata (`posting_json_metadata`).
- Profile metadata is stored as JSON in `posting_json_metadata` under the `profile` key, following Hive convention: `{ profile: { name, about, profile_image, location, website, ... } }`.
- The returned image URL from the upload is stored in app state and reused for the introduction post body.

### Open Questions

- [ ] Maximum image size / compression before upload?

---

## Step 7: Introduction Post

After profile setup, the user composes and publishes their first post to a newcomer community.

### Post Details

| Property | Value |
|----------|-------|
| Operation | `comment` (root post) via posting key |
| Default community | **OCD** (`hive-174578`) — the most active community for introduction posts, with curators who actively engage with newcomer content |
| Tags | `introduceyourself` + community tag + any additional tags from the card payload |
| Permlink | Auto-generated from title (slugified, unique) |

### Community Selection

The community for the introduction post is **configurable per card/batch**:

- **Default:** OCD (`hive-174578`) — high activity, active curation, newcomers get engagement rather than landing in a ghost town.
- **Override via card payload:** A new field (e.g. `introPostCommunity`) allows onboarders to target a different community:
  - A Chinese-speaking onboarder could target a Chinese community
  - A Spanish-speaking onboarder could target Aliento (`hive-110011`)
  - A topic-specific onboarder (gaming, art, etc.) could target a relevant community
- The community used for the intro post is independent of the `communities` field used for auto-subscribe at account creation.

### Post Content — Guided Prompts (Option B)

The user fills in two short fields. The app assembles the final post body automatically.

**User inputs:**

| Field | Label | Required | Notes |
|-------|-------|----------|-------|
| Title | — | Yes | Pre-filled with localized default (e.g. "Hello Hive!"), editable |
| About me | "About me" | Yes | 1–2 sentences: who are you? |
| Interests | "What interests you?" | Optional | 1–2 sentences: what do you want to explore on Hive? |

**User inputs (continued):**

| Field | Label | Required | Notes |
|-------|-------|----------|-------|
| Thank you | — | Pre-filled | Default: "Thank you to @{referrer} for inviting me to Hive!" — editable, user can change or remove |

The `referrer` account is already available in the gift card payload (set at batch generation time).

**Generated post body:**

```markdown
![photo](https://images.hive.blog/...)

{about me text}

{interests text, if provided}

{thank you text}

---
*Posted via [HiveInvite](https://hiveinvite.com)*
```

**Design notes:**
- Keep the UI minimal — two text areas + pre-filled thank-you, not a wall of form fields.
- The photo from step 6 is embedded automatically; no separate image picker here.
- The thank-you line is pre-filled but fully editable — the user can reword or delete it.
- The `@referrer` mention creates a notification for the inviter, closing the feedback loop.
- The footer links back to HiveInvite — attribution and discoverability.
- Future consideration: A/B test against a single-field minimal template (Option A) once there is enough volume.

### No Preview Step

No preview/confirmation screen before publishing. The user sees their inputs in the form fields — that's the preview. Adding a separate step would add friction without meaningful value. The post can always be edited later on peakd.com.

---

## Backwards Compatibility

The extended flow must be opt-in and backwards compatible:

- Cards/batches that don't specify the extended flow should behave exactly as today (direct to peakd.com after claim).
- The trigger for the extended flow could be:
  - A flag in the card payload (e.g. `extendedOnboarding: true`)
  - Presence of the `introPostCommunity` field
  - A batch-level setting in the dashboard
- The existing robust variant (direct to Propolis wallet) is unaffected.

---

## Technical Considerations

- **Broadcasting:** The invite app already bundles `hive-tx` for key derivation. Broadcasting `account_update2` and `comment` operations should be feasible with the same library.
- **Resource Credits:** A freshly created account with delegated HP from the gift card needs enough RC for: 1 profile update + 1 root post. This should be well within the delegation amount but needs verification.
- **RPC endpoint:** Standard variant uses public Hive API nodes; robust variant uses proxy endpoints from the card payload. The same routing logic applies to these new operations.
- **Posting key scope:** Both `account_update2` (for `posting_json_metadata`) and `comment` operations are within posting key authority — no additional keys needed.
- **Wallet size limit (170KB):** Does not apply here — this is the invite app, not the wallet. However, the invite app should remain reasonably small.
