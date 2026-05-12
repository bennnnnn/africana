# Africana — Monetization

## TL;DR

**Single subscription tier: Africana Pro**

| Cycle   | Price     | Effective monthly |
| ------- | --------- | ----------------- |
| Monthly | $9.99/mo  | $9.99             |
| Annual  | $59.99/yr | $5.00 (50% off)   |

While `PAYMENTS_ENABLED = false`, **everyone is on Free** and the Upgrade
screen says "Notify me 🔔". We flip the flag to `true` after hitting our first
community-size milestone.

---

## Free vs Pro

### Free (today's experience, also the future free tier)

These features stay free **for everyone forever**, paid or not:

- ✅ See who liked you — clear avatars in the Likes tab
- ✅ All Discover filters — country, age, gender, religion, ethnicity,
  languages, education, height, online-only
- ✅ Read receipts in chat
- ✅ Send and receive likes (10/day cap)
- ✅ Send and receive messages (10/day cap — the "free messages" wallet)
- ✅ Match → message (no extra cost to start a conversation once mutual)
- ✅ Edit profile, photos, settings

### Pro (paid — $9.99/mo or $59.99/yr)

Pro removes the daily caps and adds three exclusive features. Nothing in
Pro takes anything _away_ from Free — it just lifts ceilings and unlocks
new abilities:

- ⚡ **Unlimited likes** — no daily cap
- ⚡ **Unlimited messages** — no daily wallet, send as many as you want
- 👀 **See who viewed your profile** — the Views tab in Likes
- 🥷 **Hide profile / incognito browsing** — hide yourself from Discover and
  browse other profiles without leaving a view record

### Server-side anti-spam ceiling (applies to everyone, paid or free)

These are the bot-abuse triggers in
`supabase/migrations/20260417000000_rate_limits_and_delete_user.sql`. Free
users will hit the smaller `FREE_DAILY_LIKES`/`FREE_DAILY_MESSAGES` caps
long before these; Pro users effectively never hit them in normal use.

| Action   | Per rolling hour | Per rolling 24h |
| -------- | ---------------- | --------------- |
| Messages | 40               | 100             |
| Likes    | 40               | 100             |

### Daily free-tier caps

When `PAYMENTS_ENABLED = true`, free users will see a friendly "you have N
left today" indicator and an Upgrade CTA when they run out:

| Action   | Free per day | Pro per day             |
| -------- | ------------ | ----------------------- |
| Likes    | 10           | unlimited (up to 100/d) |
| Messages | 10           | unlimited (up to 100/d) |

---

## Why a single Pro tier

- **Higher conversion.** One upgrade button beats a two-tier "Gold vs
  Platinum" choice — decision paralysis kills paywall conversion.
- **Cheaper than competitors.** Tinder Plus is $14.99/mo, Hinge Premium is
  $34.99/mo. We undercut both at $9.99, and the $5/mo annual price is a
  no-brainer for users who like the app.
- **Lower operational complexity.** Fewer products in App Store Connect /
  Play Console, fewer RevenueCat entitlements, fewer support questions.
- **Soft upgrade pattern.** Pro **adds** capabilities, never **removes**
  visible information. We never blur avatars, never hide who liked you, never
  lock filters. Users feel rewarded for upgrading, not punished for not.

## Why we wait to flip `PAYMENTS_ENABLED`

Cold-start strategy used by Tinder, Hinge, and Bumble in their early days:

1. **Pre-payments phase:** all features unlocked → no friction → users tell
   friends → critical mass.
2. **Post-payments phase:** features gate when the user base is large enough
   that we lose less to churn than we gain in revenue.

If we charge before liquidity, the marketplace stays empty and reviews tank.

---

## Code surface

All payment logic lives in `src/lib/payments.ts`:

| Symbol                 | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `PAYMENTS_ENABLED`     | Master feature flag. Flip to `true` to go live.                          |
| `PRO_PLAN`             | Plan metadata (name, prices, RevenueCat IDs, feature list).              |
| `FREE_DAILY_LIKES`     | Free-tier daily like cap (10).                                           |
| `FREE_DAILY_MESSAGES`  | Free-tier daily message cap (10).                                        |
| `CAN_SEE_VIEWERS`      | Plans allowed to see who viewed their profile.                           |
| `HAS_INCOGNITO`        | Plans with incognito browsing and the profile-hide toggle.               |
| `getSubscription`      | Returns `{ plan, isActive, ... }` from RevenueCat then falls back to DB. |
| `isPremium`            | Convenience: `true` if active Pro.                                       |
| `purchasePro`          | Triggers RevenueCat purchase for `'monthly' \| 'annual'`.                |
| `restorePurchases`     | Restore on a new device.                                                 |

The Upgrade screen lives at `app/(settings)/upgrade.tsx` and renders a single
Pro card with a monthly/annual toggle (annual is selected by default to
nudge users into the higher-LTV plan).

---

## ⚠️ Current implementation status

**As of today, none of the Pro-only gating is wired.** The constants exist
in `payments.ts` but are not yet checked anywhere else in the app. Until the
gates below are implemented, flipping `PAYMENTS_ENABLED = true` would let
users pay but receive nothing in return.

### Gating roadmap (must land before `PAYMENTS_ENABLED = true`)

In rough priority order — top of the list = biggest perceived value:

- [ ] **Free daily likes cap.** In `discover.store.toggleLike`, check
      `isPremium(userId)` → if false, count today's likes (server-side via
      `like_quota` RPC) and refuse with friendly upgrade prompt at 10.
- [ ] **Free daily messages cap.** Same pattern in `chat.store.sendMessage`,
      using a `message_quota` RPC.
- [ ] **Views tab gate.** In Likes hub, when `activeTab === 'viewers'` and
      user is not in `CAN_SEE_VIEWERS`, show a "Pro" upsell card instead of
      the list.
- [x] **Hide profile.** Free users get a red Pro-gate dialog when trying to
      turn off "Show my profile" in Privacy settings.
- [x] **Incognito browsing.** `user_settings.incognito` boolean. When true,
      `app/(profile)/[id].tsx` skips the `profile_views` upsert and no
      notification is sent. Free users see the red Pro-gate dialog when
      trying to turn the toggle on.

The remaining features (see-who-liked-you, all filters, read receipts) are
**already free for everyone** and need no work.

---

## Activation checklist (when ready to launch payments)

The SDK is already wired (`src/lib/payments.ts` + `src/lib/paywall.ts`). The
remaining work is dashboard configuration. See
**[docs/revenuecat-setup.md](./revenuecat-setup.md)** for the full step-by-step.

Short version:

1. Land the remaining item in the **Gating roadmap** below (Views tab gate).
2. Configure App Store Connect, Google Play Console, RevenueCat dashboard
   per `docs/revenuecat-setup.md`.
3. Set EAS env vars for the RevenueCat API keys.
4. Flip `PAYMENTS_ENABLED = true` in `src/lib/payments.ts`.
5. `npx expo prebuild --clean && eas build --profile production --platform all`
6. `eas submit --platform all`
7. Sandbox-test on a real device before promoting from internal to production.

---

## Early-sharer reward (growth phase)

While total profiles are below `GROWTH_SHARE_REWARD_UNTIL_PROFILE_COUNT`
(currently 10,000) **and** `PAYMENTS_ENABLED = true`, any user who has
recorded a profile share is granted Pro-equivalent access for free, until
we cross that threshold. This rewards early word-of-mouth growth without
giving away revenue at scale. See `src/lib/share-reward.ts`.

---

## Pricing rationale

| Provider                     | Monthly | Annual effective |
| ---------------------------- | ------- | ---------------- |
| Tinder Plus                  | $14.99  | $9.99            |
| Hinge Premium                | $34.99  | $19.99           |
| Bumble Premium               | $39.99  | $14.99           |
| **Africana Pro**             | $9.99   | $5.00            |

We sit below every major competitor on both monthly and annual pricing,
which:

- Lowers the "is this worth it?" barrier
- Encourages annual conversion (the math is obvious at $5 vs $9.99)
- Leaves room to raise prices later without alienating early subscribers
  (grandfather them in)
