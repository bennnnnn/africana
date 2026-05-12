# RevenueCat Setup — Africana

Step-by-step guide for configuring RevenueCat for **Africana Pro** ($9.99/mo or
$59.99/yr, single tier). Code wiring is already done — this doc is the
checklist for the RevenueCat dashboard + App Store Connect + Play Console.

The app is wired against:

- **Entitlement identifier:** `pro`
- **Package identifiers:** `$rc_monthly` and `$rc_annual` (the RevenueCat
  built-in package types — easiest to use because they map automatically
  across stores)

If you choose different identifiers in the dashboard, update
`RC_ENTITLEMENT_ID` in `src/lib/payments.ts` to match.

---

## 1. Install + native rebuild (done in code already)

```bash
# Already installed:
#   react-native-purchases       (^10.x)
#   react-native-purchases-ui    (^10.x)

# After pulling these changes, regenerate native dirs and rebuild:
npx expo prebuild --clean
eas build --profile development --platform android
# (or ios) — sandbox testing requires a real device build, not Expo Go.
```

---

## 2. Environment variables

Local `.env` (already set for test mode):

```
EXPO_PUBLIC_REVENUECAT_API_KEY=test_NNMyCJerOxhWpeDVrQxoZcWaQmv
```

For production, replace with platform-specific keys from RevenueCat dashboard
→ Project Settings → API Keys:

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxx
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxx
```

EAS env (set for `development`, `preview`, `production`):

```bash
eas env:create --name EXPO_PUBLIC_REVENUECAT_API_KEY --value 'test_xxx' \
  --environment development --environment preview --environment production \
  --visibility plaintext --non-interactive --scope project
```

---

## 3. App Store Connect (iOS)

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com).
2. Apps → Africana → **Subscriptions**.
3. Create a Subscription Group called `africana_pro`.
4. Inside the group, create **two** auto-renewing subscriptions:

| Product Reference Name | Product ID              | Duration | Price  |
| ---------------------- | ----------------------- | -------- | ------ |
| Africana Pro Monthly   | `africana_pro_monthly`  | 1 Month  | $9.99  |
| Africana Pro Yearly    | `africana_pro_annual`   | 1 Year   | $59.99 |

5. For each subscription:
   - Add a localized display name: `Africana Pro`
   - Add a localized description: `Unlimited likes and messages, see who viewed you, and browse privately.`
   - Set "Status" to **Ready to Submit** (you don't need to attach to a build
     yet — RevenueCat will pick them up).
6. Agreements, Tax and Banking → make sure the Paid Apps Agreement is signed.

---

## 4. Google Play Console (Android)

1. Sign in to [Play Console](https://play.google.com/console).
2. Africana → Monetize → **Subscriptions**.
3. Create a subscription with **Product ID `africana_pro`** and name
   `Africana Pro`.
4. Add **two base plans** on that subscription:

| Base plan ID | Billing period | Auto-renewing | Price   |
| ------------ | -------------- | ------------- | ------- |
| `monthly`    | Monthly        | Yes           | $9.99   |
| `annual`     | Yearly         | Yes           | $59.99  |

5. Activate both base plans.
6. Set up Merchant account if you haven't already (Google Play → Setup →
   Payments profile).

---

## 5. RevenueCat dashboard

1. Sign in to [app.revenuecat.com](https://app.revenuecat.com) → select the
   Africana project.
2. **Project Settings → Apps:** confirm both iOS and Android apps are
   connected with the right bundle IDs:
   - iOS: `com.africana.dating`
   - Android: `com.africana.dating`
3. **Project Settings → API Keys:** copy the iOS and Android public keys
   into EAS env vars (`EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`).
4. **Products** (left sidebar):
   - Click **+ New** → import store products.
   - From the iOS app: import `africana_pro_monthly` and
     `africana_pro_annual`.
   - From the Android app: import the `monthly` and `annual` base plans of
     `africana_pro`.
   - You'll end up with 4 products total (2 per platform). RevenueCat will
     group them automatically by package type.
5. **Entitlements:**
   - Click **+ New entitlement**.
   - Identifier: `pro`
   - Display name: `Africana Pro`
   - Description: `Unlimited likes and messages, see who viewed you, hide
     your profile.`
   - Attach all 4 products above to this entitlement.
6. **Offerings:**
   - Click **+ New offering** → identifier `default`, description `Default
     paywall`.
   - Add two packages:
     - Identifier: `$rc_monthly` → attach iOS + Android monthly products
     - Identifier: `$rc_annual` → attach iOS + Android annual products
   - Mark `default` as the **Current Offering**.

---

## 6. Paywall (RevenueCat-hosted UI)

1. RevenueCat dashboard → **Paywalls** → Editor.
2. Pick a template (Trifecta or Carousel work well for dating apps).
3. Configure:
   - Header: `Africana Pro`
   - Subheader: `Unlimited likes, see who viewed you, and more.`
   - Features list — mirror what's in `src/lib/payments.ts → PRO_PLAN.features`:
     - Unlimited likes
     - Unlimited messages
     - See who viewed your profile
     - Hide profile / incognito browsing
   - Footer: Terms → https://joinafricana.com/terms ·
     Privacy → https://joinafricana.com/privacy
4. **Publish** → assign to the `default` offering.

You can edit the paywall any time after launch — changes ship instantly
without an app store update.

---

## 7. Customer Center (RevenueCat-hosted UI)

1. RevenueCat dashboard → **Customer Center** → Editor.
2. Recommended sections:
   - **Subscription status** (auto)
   - **Cancel subscription** (auto)
   - **Restore purchases** (auto)
   - **Contact support** → support email: `support@joinafricana.com`
   - **Help links** → privacy + terms
3. Publish.

The app surfaces this from **Settings → Premium & trust → Manage
subscription**.

---

## 8. Flip the launch switch

When the four checklists above are green:

1. Open `src/lib/payments.ts`.
2. Change:
   ```ts
   export const PAYMENTS_ENABLED = false;
   ```
   to:
   ```ts
   export const PAYMENTS_ENABLED = true;
   ```
3. Build + submit:
   ```bash
   eas build --profile production --platform all
   eas submit --platform all
   ```

---

## 9. Sandbox testing

### iOS

1. App Store Connect → Users and Access → **Sandbox Testers** → add a test
   user (use a fresh email; you cannot reuse production Apple IDs).
2. On a real iOS device, settings → Developer → Sandbox Apple Account → sign
   in with the test user.
3. Install Africana from TestFlight.
4. Open Settings → Premium & trust → Go Pro → paywall appears → tap a plan
   → enter sandbox password → purchase completes.
5. Verify in RevenueCat dashboard → Customers → your sandbox user shows
   active entitlement `pro`.

### Android

1. Play Console → Setup → **License testing** → add the Gmail account that
   will test.
2. Internal Testing track → add the same Gmail as an internal tester →
   accept the invite.
3. Install Africana from the internal-testing link.
4. Same flow as iOS — purchase will say "TEST PAYMENT" but completes
   end-to-end.
5. RevenueCat → Customers → confirm `pro` entitlement.

### App behavior to verify

- 11th like in one day → red Pro alert dialog when on Free, no dialog when on Pro
- 11th message in one day → same
- Privacy → Hide my profile → Free shows red Pro alert, Pro toggles
- Privacy → Incognito browsing → same
- Settings → Premium & trust → Manage subscription → opens Customer Center
- Sign out + sign in as a different user → `getCachedSubscription()` flips
  appropriately (test by signing out from a Pro account into a Free one)

---

## 10. Building custom Pro UI (advanced)

The RevenueCat-hosted paywall (`presentPaywall()`) renders the offering from
the dashboard and is the recommended path for the main upgrade flow. If you
later want to build a *custom* UI — an inline upsell card on Discover, a
product-comparison screen, an A/B-tested paywall using Placements — use the
typed helpers in `src/lib/payments.ts`:

```ts
import {
  getCurrentOffering,
  getCurrentOfferingForPlacement,
  getAllOfferings,
  purchasePackage,
  type RcOffering,
  type RcPackage,
} from '@/lib/payments';

// Fetch what the dashboard says should be shown to this user right now:
const offering = await getCurrentOffering();
const monthly = offering?.monthly;
const annual = offering?.annual;

// Or fetch by placement (configure in RevenueCat → Project → Placements):
const postMatch = await getCurrentOfferingForPlacement('post_match');

// Purchase directly without opening the full paywall:
if (monthly) {
  const result = await purchasePackage(monthly);
  if (result.success) {
    // user is now Pro; isProSync() returns true
  }
}
```

**Best practices baked into the helpers:**

- ✅ No hardcoded product IDs — everything comes from the live offering.
- ✅ Normalized package shape works the same on iOS and Android.
- ✅ Safe no-op return values when `PAYMENTS_ENABLED = false` or the SDK
  isn't linked (Expo Go).
- ✅ `purchasePackage()` automatically updates the in-memory cache so
  `isProSync()` flips immediately on success — no manual refresh needed.

## 11. Server-side validation (optional, post-launch)

For maximum security, set up the RevenueCat webhook to sync entitlement
events directly to our `public.subscriptions` table:

1. RevenueCat dashboard → Project Settings → **Integrations** → Webhooks.
2. URL: `https://smosvscutnzrrqgyqzhd.supabase.co/functions/v1/revenuecat-webhook`
3. Authorization header: `Bearer <random shared secret>`
4. Create a `revenuecat-webhook` Supabase Edge Function that verifies the
   shared secret and upserts into `public.subscriptions`.

Until that webhook exists, the in-app SDK + the `subscriptions` table
upsert from `payments.ts → syncSubscriptionToDb` is the source of truth.
