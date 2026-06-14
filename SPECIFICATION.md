# Africana — Complete Business Rules & Constants Specification

> Generated from production code. Every value annotated with its source file:line.

---

## Table of Contents

1. [Auth](#1-auth)
   - [1.1 Registration (Email)](#11-registration-email)
   - [1.2 Supabase Auth Config](#12-supabase-auth-config)
   - [1.3 Google OAuth](#13-google-oauth)
   - [1.4 Apple Sign-In](#14-apple-sign-in)
2. [Onboarding](#2-onboarding)
   - [2.1 Steps](#21-steps)
   - [2.2 Validation Rules](#22-validation-rules)
   - [2.3 Location & Cultural Logic](#23-location--cultural-logic)
   - [2.4 Skip Logic & Redirects](#24-skip-logic--redirects)
3. [Profile & Constants](#3-profile--constants)
   - [3.1 Option Arrays](#31-option-arrays)
   - [3.2 Age & Photo Limits](#32-age--photo-limits)
   - [3.3 Country List (African + Diaspora)](#33-country-list-african--diaspora)
   - [3.4 Design Tokens](#34-design-tokens)
4. [Face Detection](#4-face-detection)
5. [Validation](#5-validation)
6. [Payments & Subscriptions](#6-payments--subscriptions)
   - [6.1 Monetization Model](#61-monetization-model)
   - [6.2 Free-Tier Limits](#62-free-tier-limits)
   - [6.3 Pro Features](#63-pro-features)
   - [6.4 Feature Gates](#64-feature-gates)
   - [6.5 RevenueCat IDs](#65-revenuecat-ids)
7. [Free-Tier Daily Quota](#7-free-tier-daily-quota)
   - [7.1 Client-Side Gate](#71-client-side-gate)
   - [7.2 Server-Side Enforcement (DB Trigger)](#72-server-side-enforcement-db-trigger)
   - [7.3 DB Rate Limit Constants](#73-db-rate-limit-constants)
8. [Rate Limit Warnings](#8-rate-limit-warnings)
9. [Messaging](#9-messaging)
   - [9.1 sendMessage Flow](#91-sendmessage-flow)
   - [9.2 Pagination & Caching](#92-pagination--caching)
   - [9.3 Conversation Management](#93-conversation-management)
   - [9.4 Error Constants](#94-error-constants)
10. [Discovery Feed](#10-discovery-feed)
11. [Blocking](#11-blocking)
12. [Content Moderation](#12-content-moderation)
13. [Privacy & Safety](#13-privacy--safety)
    - [13.1 Privacy Toggles (Default Values)](#131-privacy-toggles-default-values)
    - [13.2 Account Deletion Flow](#132-account-deletion-flow)
    - [13.3 Report Reasons](#133-report-reasons)
    - [13.4 Shadowban (Auto-Moderation)](#134-shadowban-auto-moderation)
    - [13.5 Moderation Lock](#135-moderation-lock)

---

## 1. Auth

### 1.1 Registration (Email)

| Rule | Value | Source |
|---|---|---|
| Fields collected | Email, Password, Terms Accepted | `app/(auth)/register.tsx:37-38,47` |
| Password minimum length (client) | `6` (from `MIN_PASSWORD_LENGTH`) | `src/lib/validation.ts:20` |
| Password placeholder | `"{MIN_PASSWORD_LENGTH}+ characters"` | `app/(auth)/register.tsx:299` |
| Email validation | RFC 5322 simplified regex | `src/lib/validation.ts:7-8` |
| Password validation | Must be >= 6 characters | `src/lib/validation.ts:22-28` |
| Submit debounce | 1 second guard (`submitGuardRef`) | `app/(auth)/register.tsx:103-105` |
| Email redirect (post-signup) | `africana://auth/callback` | `app/(auth)/register.tsx:129` |
| Email normalization | `email.trim().toLowerCase()` | `app/(auth)/register.tsx:51` |
| Terms must be accepted | Checked before submit | `app/(auth)/register.tsx:113-121` |
| Onboarding redirect params | `{ userId, email, termsAccepted: '1' }` | `app/(auth)/register.tsx:204-207` |
| Social providers | Google (all platforms), Apple (iOS only) | `app/(auth)/register.tsx:232-259` |

**Rate-limit error message:** "You've reached the email limit. Please wait 1 hour, or sign in with Google instead — it's instant." — `app/(auth)/register.tsx:140-141`

### 1.2 Supabase Auth Config

| Setting | Value | Source |
|---|---|---|
| `site_url` | `"https://joinafricana.com"` | `supabase/config.toml:154` |
| `additional_redirect_urls` | `["https://joinafricana.com", "https://www.joinafricana.com", "africana://reset-password", "africana://auth/callback"]` | `supabase/config.toml:156` |
| `jwt_expiry` | `3600` (1 hour) | `supabase/config.toml:158` |
| `enable_refresh_token_rotation` | `true` | `supabase/config.toml:164` |
| `refresh_token_reuse_interval` | `10` seconds | `supabase/config.toml:167` |
| `enable_signup` | `true` | `supabase/config.toml:169` |
| `enable_anonymous_sign_ins` | `false` | `supabase/config.toml:171` |
| `enable_manual_linking` | `false` | `supabase/config.toml:173` |
| `minimum_password_length` | `6` | `supabase/config.toml:175` |
| `password_requirements` | `""` (empty — no extra requirements) | `supabase/config.toml:178` |
| `enable_confirmations` (email) | `false` | `supabase/config.toml:209` |
| `enable_confirmations` (SMS) | `false` | `supabase/config.toml:244` |
| `double_confirm_changes` | `true` | `supabase/config.toml:207` |
| `secure_password_change` | `false` | `supabase/config.toml:211` |
| `max_frequency` (email) | `"1s"` | `supabase/config.toml:213` |
| `otp_length` (email) | `6` | `supabase/config.toml:215` |
| `otp_expiry` (email) | `3600` seconds | `supabase/config.toml:217` |
| `enable_signup` (SMS) | `false` | `supabase/config.toml:242` |
| `max_frequency` (SMS) | `"5s"` | `supabase/config.toml:248` |
| `max_frequency` (MFA phone) | `"5s"` | `supabase/config.toml:295` |

**Auth Rate Limits** (`[auth.rate_limit]`):

| Bucket | Value | Window | Source |
|---|---|---|---|
| `email_sent` | 2 | per hour | `supabase/config.toml:182` |
| `sms_sent` | 30 | per hour | `supabase/config.toml:184` |
| `anonymous_users` | 30 | per hour per IP | `supabase/config.toml:186` |
| `token_refresh` | 150 | per 5 min per IP | `supabase/config.toml:188` |
| `sign_in_sign_ups` | 30 | per 5 min per IP | `supabase/config.toml:190` |
| `token_verifications` | 30 | per 5 min per IP | `supabase/config.toml:192` |
| `web3` | 30 | per 5 min per IP | `supabase/config.toml:194` |

**Auth MFA**:

| Setting | Value | Source |
|---|---|---|
| `max_enrolled_factors` | 10 | `supabase/config.toml:282` |
| `enroll_enabled` (TOTP) | `false` | `supabase/config.toml:286` |
| `verify_enabled` (TOTP) | `false` | `supabase/config.toml:287` |
| `enroll_enabled` (Phone) | `false` | `supabase/config.toml:291` |
| `verify_enabled` (Phone) | `false` | `supabase/config.toml:292` |
| `otp_length` (MFA phone) | 6 | `supabase/config.toml:293` |

### 1.3 Google OAuth

| Rule | Value | Source |
|---|---|---|
| Provider | `'google'` | `src/lib/google-auth.ts:41` |
| Redirect URI scheme | `'africana'`, path `'auth/callback'` | `src/lib/google-auth.ts:8` |
| OAuth params | `access_type: 'offline'`, `prompt: 'consent'` | `src/lib/google-auth.ts:45` |
| `skipBrowserRedirect` | `true` | `src/lib/google-auth.ts:44` |
| Auth flow | Opens `WebBrowser.openAuthSessionAsync`, exchanges code for session | `src/lib/google-auth.ts:51-58` |
| JWT detection | 3 base64url segments separated by dots | `src/lib/google-auth.ts:11-15` |

### 1.4 Apple Sign-In

| Rule | Value | Source |
|---|---|---|
| Provider | `'apple'` | `src/lib/apple-auth.ts:9` |
| `skipBrowserRedirect` | `true` | `src/lib/apple-auth.ts:10` |
| Redirect URI | Same as Google (shared `getRedirectUri()`) | `src/lib/apple-auth.ts:7` |
| Auth flow | Mirrors Google's flow (`WebBrowser.openAuthSessionAsync`) | `src/lib/apple-auth.ts:13-16` |

---

## 2. Onboarding

### 2.1 Steps

Total steps: `6` (plus celebration screen as step 7). — `src/constants/onboarding-screen-data.ts:3`

| Step | Title | Subtitle | Emoji | Background | Source |
|---|---|---|---|---|---|
| 1 (Name) | "What's your name?" | "This is how you'll appear to others on Africana." | 👤 | #FFF3E0 | `onboarding-screen-data.ts:6-10` |
| 2 (Photos) | "Add your photo" | "Profiles with a photo get 6× more matches." | 📸 | #FFF8E1 | `onboarding-screen-data.ts:12-16` |
| 3 (Basics) | "A bit about you" | "A few basics to help us find the right people." | 🎂 | #E8F5E9 | `onboarding-screen-data.ts:18-22` |
| 4 (Intent) | "What are you looking for?" | "Be honest — the right match is out there." | 💞 | #FCE4EC | `onboarding-screen-data.ts:24-28` |
| 5 (Location) | "Where do you live?" | "Your location helps people near you find you." | 📍 | #E0F7FA | `onboarding-screen-data.ts:30-34` |
| 6 (Roots) | "Your roots" | "Ethnicity and languages help us find your people." | 🌍 | #E8F5E9 | `onboarding-screen-data.ts:36-41` |

**Fields collected per step:**

- **Step 1:** `fullName` (text), `termsAccepted` (checkbox) — `app/(auth)/onboarding.tsx:67,69`
- **Step 2:** `photoUris` (array of URLs, max `MAX_PROFILE_PHOTOS`=6) — `app/(auth)/onboarding.tsx:72`
- **Step 3:** `birthdate` (Date), `gender` (Gender enum), `interestedIn` (InterestedIn enum) — `app/(auth)/onboarding.tsx:75-78`
- **Step 4:** `lookingFor` (array of LookingFor) — `app/(auth)/onboarding.tsx:93`
- **Step 5:** `location` (LocationValue: country, countryCode, subdivision, city), `originLocation` (same shape) — `app/(auth)/onboarding.tsx:98-99`
- **Step 6:** `ethnicity` (string), `languages` (string array) — `app/(auth)/onboarding.tsx:102-103`

**Onboarding Gender options:** `['male', 'female']` only — `ONBOARDING_GENDER_OPTIONS` at `onboarding-screen-data.ts:50-53`

**Onboarding Interest options:** `['women', 'men']` only (no "Everyone") — `ONBOARDING_INTEREST_OPTIONS` at `onboarding-screen-data.ts:46-48`

**Onboarding Looking For options:**

| Value | Label | Description | Emoji |
|---|---|---|---|
| `relationship` | Relationship | A deep, meaningful connection | 💑 |
| `marriage` | Marriage | Serious, long-term commitment | 💍 |
| `friendship` | Friendship | Friends first, see what happens | 🤝 |
| `pen_pal` | Pen Pal | Chat, share stories, connect | ✉️ |

— `onboarding-screen-data.ts:61-75`

### 2.2 Validation Rules

- **Step 1:** `NameValidation.valid && termsAccepted` — `onboarding.tsx:610`
- **Step 2:** `photoUris.length > 0 && !photoPickingProgress && !photoProgress` — `onboarding.tsx:611`
- **Step 3:** `birthdate && gender && interestedIn` AND `years >= 18 && years <= 120` — `onboarding.tsx:612-615`
- **Step 4:** `lookingFor.length > 0` — `onboarding.tsx:617`
- **Step 5 (Africa):** `locationPathComplete` (country + subdivision + city all present) — `onboarding.tsx:619`
- **Step 5 (Diaspora):** `!!location.country` — `onboarding.tsx:620`
- **Steps 6 & 7:** always OK — `onboarding.tsx:622`

**Age validation (hard gate):** `ageYears < 18` → "You must be 18 or older" dialog; `ageYears > 120` → "Check your date of birth" dialog — `onboarding.tsx:457-474`

### 2.3 Location & Cultural Logic

| Rule | Value / Logic | Source |
|---|---|---|
| African country codes set | `AFRICAN_COUNTRY_CODES` (from `country-data.ts`) | `onboarding.tsx:179` |
| `livesInAfrica` | `africanCountryCodes.has(livingCountry.code)` | `onboarding.tsx:186` |
| `needsOriginCountry` | `Boolean(livingCountry) && !livesInAfrica` | `onboarding.tsx:187` |
| `culturalLocation` | If lives in Africa → living location; if diaspora with African origin → origin location; else null | `onboarding.tsx:191-198` |
| `locationPathComplete` | `culturalLocation?.country && culturalLocation?.subdivision && culturalLocation?.city` | `onboarding.tsx:199-201` |
| `showRootsStep` (show step 6) | `livesInAfrica ? locationPathComplete : Boolean(livingCountry)` | `onboarding.tsx:203` |
| IP location prefill triggered | When `step === 5` and no country set yet | `onboarding.tsx:308-334` |
| Ethnicity/language reset on country/subdivision/city change | Yes | `onboarding.tsx:277-302` |

### 2.4 Skip Logic & Redirects

| Rule | Detail | Source |
|---|---|---|
| Returning user without photo → lands on Step 2 with basics prefilled | Checked when `step === 1` and `hasDiscoverBasics(user) && !hasDiscoverPhoto(user)` | `onboarding.tsx:142-176` |
| Already complete user (not on step 7) → redirected to Discover | `isProfileCompleteForDiscover(user)` check | `onboarding.tsx:642-647` |
| No photo at save → error: "A photo is required before you can appear in Discover or browse other members." | `uploadedUrls.length === 0` | `onboarding.tsx:519-529` |
| Step 5 without `showRootsStep` → skip step 6, save with `skipCultureFields=true` | `goNext` at step 5 check | `onboarding.tsx:634-636` |
| Step 6 "Skip for now" → save with `skipCultureFields=true` | Visible via ghost button | `onboarding.tsx:1091-1103`, `handleSaveProfile(true)` |
| Step 7 (celebration) → "Start Exploring →" goes to `/(tabs)/discover` | `onboarding.tsx:630-632, 680-681` | |
| Celebration screen | SVG-like title "Welcome to Africana!" with 🎉 | `onboarding.tsx:671-676` |

**`handleSaveProfile` validation order (before save):**
1. userId + email present
2. firstName validation passes
3. termsAccepted
4. birthdate, gender, interestedIn all set
5. age >= 18
6. age <= 100
7. location.country present
8. lookingFor.length > 0
9. At least 1 photo uploaded (HTTP URL)
— `onboarding.tsx:422-529`

---

## 3. Profile & Constants

### 3.1 Option Arrays

#### GENDER_OPTIONS (all genders — for display/DB)
| Value | Label |
|---|---|
| `male` | Male |
| `female` | Female |
 

— `src/constants/index.ts:221-226`

#### PROFILE_GENDER_OPTIONS (Male/Female only — onboarding + profile edit)
Filtered from `GENDER_OPTIONS`: `['male', 'female']` — `src/constants/index.ts:229-231`

#### INTERESTED_IN_OPTIONS
| Value | Label |
|---|---|
| `women` | Women |
| `men` | Men |
 

— `src/constants/index.ts:233-237`

#### PROFILE_INTERESTED_IN_OPTIONS  
Filtered from `INTERESTED_IN_OPTIONS`: `['women', 'men']` — `src/constants/index.ts:240-242`

#### LOOKING_FOR_OPTIONS
| Value | Label |
|---|---|
| `relationship` | Relationship |
| `marriage` | Marriage |
| `friendship` | Friendship |
| `pen_pal` | Pen Pal |

— `src/constants/index.ts:257-262`

#### RELIGION_OPTIONS
| Value | Label | Emoji |
|---|---|---|
| `christianity` | Christianity | ✝️ |
| `catholicism` | Catholic | ✝️ |
| `protestantism` | Protestant | ✝️ |
| `pentecostal` | Pentecostal | ✝️ |
| `orthodox_christian` | Orthodox Christian | ☦️ |
| `islam` | Islam | ☪️ |
| `judaism` | Judaism | ✡️ |
| `buddhism` | Buddhism | ☸️ |
| `hinduism` | Hinduism | 🕉️ |
| `atheist` | Atheist | ⚛️ |
| `other` | Other | 🙏 |

— `src/constants/index.ts:264-277`

#### EDUCATION_OPTIONS
`high_school`, `some_college`, `vocational`, `bachelors`, `masters`, `phd`, `other` — `index.ts:279-287`

#### OCCUPATION_OPTIONS
44 values (accountant through writer, plus `other`) — `index.ts:289-337`

#### PHYSICAL_CONDITION_OPTIONS
`slim`, `athletic`, `average`, `curvy`, `plus_size`, `prefer_not_to_say` — `index.ts:339-346`

#### MARITAL_STATUS_OPTIONS
`single`, `divorced`, `widowed`, `separated` (with emoji) — `index.ts:348-353`

#### HAS_CHILDREN_OPTIONS
`true` / `false` — `index.ts:244-247`

#### WANT_CHILDREN_OPTIONS
`yes` / `no` (alias for `WANT_CHILDREN_YES_NO`) — `index.ts:249-255`

### 3.2 Age & Photo Limits

| Constant | Value | Source |
|---|---|---|
| `MIN_AGE` | 18 | `src/constants/index.ts:370` |
| `MAX_AGE` | 100 | `src/constants/index.ts:371` |
| `MAX_PROFILE_PHOTOS` | 6 | `src/constants/index.ts:369` |
| `DEFAULT_AVATAR` | `https://ui-avatars.com/api/?background=0E9F6E&color=fff&size=200&name=` | `src/constants/index.ts:367-368` |

### 3.3 Country List (African + Diaspora)

**African countries (54):** DZ, AO, BJ, BW, BF, BI, CV, CM, CF, TD, KM, CG, CD, CI, DJ, EG, GQ, ER, SZ, ET, GA, GM, GH, GN, GW, KE, LS, LR, LY, MG, MW, ML, MR, MU, MA, MZ, NA, NE, NG, RW, ST, SN, SC, SL, SO, ZA, SS, SD, TZ, TG, TN, UG, ZM, ZW

**Diaspora countries (18):** US, GB, CA, FR, DE, NL, AU, SE, NO, IT, ES, BE, PT, CH, AE, SA, QA, NZ

Total: 72 countries in `AFRICAN_COUNTRIES` list — `src/constants/index.ts:145-219`

### 3.4 Design Tokens

**Primary brand color:** `#0E9F6E` (green) — `index.ts:4`
**App name:** `'Africana'` — `index.ts:355`

Full color palette, typography scale, spacing/radius, and shadow presets documented in `src/constants/index.ts:1-143`.

---

## 4. Face Detection

| Rule | Value | Source |
|---|---|---|
| Detection engine | Google ML Kit (native module `FaceDetection`) | `src/lib/face-detection.ts:3-4` |
| Performance mode | `'fast'` | `face-detection.ts:58` |
| Landmark mode | `'none'` | `face-detection.ts:59` |
| Contour mode | `'none'` | `face-detection.ts:60` |
| Classification mode | `'none'` | `face-detection.ts:61` |
| `minFaceSize` | `0.1` | `face-detection.ts:62` |
| 0 faces → **rejected** (reason: `'no_face'`) | Hard reject | `face-detection.ts:69,84-86` |
| 1 face → **accepted** | Pass | `face-detection.ts:70` |
| 2+ faces → **accepted** (group photos allowed) | Soft pass (future: possibly reject) | `face-detection.ts:71-72` |
| ML Kit error → **fail open** (photo accepted) | `reason: 'error'` → treated as soft pass | `face-detection.ts:89-91,126` |
| Native module unavailable → **fail open** (all accepted) | Warning logged in dev | `face-detection.ts:76-79,110-113` |
| Batch validation | Runs `Promise.all` in parallel | `face-detection.ts:115-117` |

**Face rejection dialog messages:** — `face-detection.ts:136-157`

| Condition | Title | Message |
|---|---|---|
| 1 rejected, 0 approved | "Face not found" | "Use a photo where your face is clearly visible." |
| >1 rejected, 0 approved | "Faces not found" | "Use photos where faces are clearly visible." |
| Mix (some approved, some rejected) | `"Skipped {n} photo(s)"` | `"{n} photos were skipped because no face was found. {approvedCount} uploaded."` |

---

## 5. Validation

| Rule | Pattern / Logic | Value | Source |
|---|---|---|---|
| Email regex | RFC 5322 simplified | `/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/` | `validation.ts:7-8` |
| name regex | Unicode letters + hyphens/apostrophes | `/^[\p{L}]+(?:[-'][\p{L}]+)*$/u` | `validation.ts:10` |
| `MIN_PASSWORD_LENGTH` | `6` | `validation.ts:20` |
| Password | Must be >= 6 chars | `validation.ts:24-26` |
| name required | Error: " Name is required." | `validation.ts:32` |
| Name no spaces | Error: "Use  name only." | `validation.ts:33` |
|  name letters only | Error: "Use letters only." | `validation.ts:34` |
| name min length | >= 2 chars, else "Name is too short." | `validation.ts:35` |
| Email required | Error: "Email is required." | `validation.ts:14` |
| Email invalid format | Error: "Enter a valid email." | `validation.ts:15` |
| Password required | Error: "Password is required." | `validation.ts:23` |

---

## 6. Payments & Subscriptions

### 6.1 Monetization Model

| Feature | Value | Source |
|---|---|---|
| `PAYMENTS_ENABLED` | `false` (Phase 1 — all users Free) | `src/lib/payments.ts:53` |
| Single subscription tier | **Africana Pro** | `payments.ts:8` |
| Monthly price | `$9.99` / month | `payments.ts:9,81` |
| Annual price | `$59.99` / year (~$5/mo) | `payments.ts:10,82` |
| Annual discount | `50% off` ($5.00/mo equivalent) | `payments.ts:83,84` |
| RC Entitlement ID | `'pro'` | `payments.ts:57` |

### 6.2 Free-Tier Limits

| Constant | Value | Source |
|---|---|---|
| `FREE_DAILY_LIKES` | `10` | `src/lib/payments.ts:101` |
| `FREE_DAILY_MESSAGES` | `10` | `src/lib/payments.ts:102` |

### 6.3 Pro Features

| Feature | Value | Source |
|---|---|---|
| Unlimited likes | ✓ | `payments.ts:91` |
| Unlimited messages | ✓ | `payments.ts:92` |
| See who viewed your profile (Views tab) | ✓ | `payments.ts:93` |
| Hide profile / incognito browsing | ✓ | `payments.ts:94` |

**Free for everyone (no gate):** See who liked you (clear avatars), All Discover filters, Read receipts in chat — `payments.ts:31-33`

### 6.4 Feature Gates

| Gate | Allowed Plans | Source |
|---|---|---|
| `CAN_SEE_VIEWERS` | `['pro']` | `payments.ts:106` |
| `HAS_INCOGNITO` | `['pro']` | `payments.ts:109` |

### 6.5 RevenueCat IDs

| Identifier | Value | Source |
|---|---|---|
| Monthly package | `'$rc_monthly'` | `payments.ts:87` |
| Annual package | `'$rc_annual'` | `payments.ts:88` |
| SDK key (iOS) | `process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY` | `payments.ts:153-154` |
| SDK key (Android) | `process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | `payments.ts:155` |
| SDK key (fallback) | `process.env.EXPO_PUBLIC_REVENUECAT_API_KEY` | `payments.ts:156` |

---

## 7. Free-Tier Daily Quota

### 7.1 Client-Side Gate

| Rule | Value | Source |
|---|---|---|
| Pro check | `isProSync()` — if true, skip all gates | `src/lib/free-quota.ts:116,136` |
| `gateSendMessage()` | Checks `counts.messages >= FREE_DAILY_MESSAGES` (10) | `free-quota.ts:125` |
| `gateSendLike()` | Checks `counts.likes >= FREE_DAILY_LIKES` (10) | `free-quota.ts:145` |
| Gate serialization | Mutex (`gateMutex`) to prevent concurrent over-spend | `free-quota.ts:27,118-131,138-151` |
| Cache refresh | `refreshQuotaCounts()` force-reads from server | `free-quota.ts:53-57` |
| UTC day key | `new Date().toISOString().slice(0, 10)` | `free-quota.ts:30` |
| Server RPC called | `supabase.rpc('rate_limit_counts')` | `free-quota.ts:38` |
| `showFreeLimitDialog` | "You've used your {cap} free {noun} today" → Upgrade CTA | `free-quota.ts:157-161` |
| In-memory increment after success | `noteSentMessage()` / `noteSentLike()` | `free-quota.ts:76-85` |
| Reset on sign-out | `resetFreeQuotaCache()` | `free-quota.ts:165-169` |

### 7.2 Server-Side Enforcement (DB Trigger)

**`enforce_message_rate_limit()` trigger** — `20260608120000_free_tier_daily_caps.sql:27-94`
**`enforce_like_rate_limit()` trigger** — `20260608120000_free_tier_daily_caps.sql:97-164`

Both triggers check:
1. Free cap (`max_free_per_day`) — only if NOT Pro
2. Hourly anti-spam (`max_per_hour`)
3. Daily anti-spam (`max_per_day`)

### 7.3 DB Rate Limit Constants

| Constant | Value | Source |
|---|---|---|
| `max_per_hour` (messages) | `40` | `free_tier_daily_caps.sql:37,107` |
| `max_per_day` (messages) | `100` | `free_tier_daily_caps.sql:38,108` |
| `max_free_per_day` (messages) | `10` | `free_tier_daily_caps.sql:39,109` |
| `max_per_hour` (likes) | `40` | `free_tier_daily_caps.sql:107` |
| `max_per_day` (likes) | `100` | `free_tier_daily_caps.sql:108` |
| `max_free_per_day` (likes) | `10` | `free_tier_daily_caps.sql:109` |

**Rate limit error codes (PostgreSQL `23P01`):** — `free_tier_daily_caps.sql:56,74,88,126,143,157`

| Condition | Message | Detail |
|---|---|---|
| Free messages cap | "You've used your 10 free messages today." | `rate_limit:messages:free` |
| Hourly messages cap | "You're sending messages too fast. Please wait a bit and try again." | `rate_limit:messages:hour` |
| Daily messages cap | "You've reached today's message limit. Please try again tomorrow." | `rate_limit:messages:day` |
| Free likes cap | "You've used your 10 free likes today." | `rate_limit:likes:free` |
| Hourly likes cap | "You're liking too fast. Take a breather and try again in a bit." | `rate_limit:likes:hour` |
| Daily likes cap | "You've reached today's like limit. Upgrade or come back tomorrow." | `rate_limit:likes:day` |

**`rate_limit_counts()` RPC:** Returns JSONB with fields: `is_pro`, `messages_hour_used`, `messages_hour_limit`, `messages_day_used`, `messages_day_limit`, `messages_free_used`, `messages_free_limit`, `likes_hour_used`, `likes_hour_limit`, `likes_day_used`, `likes_day_limit`, `likes_free_used`, `likes_free_limit` — `free_tier_daily_caps.sql:167-241`

**`user_has_active_pro(p_user_id)` function:** Checks `subscriptions` table for active 'pro' plan with non-expired `expires_at` — `free_tier_daily_caps.sql:6-21`

---

## 8. Rate Limit Warnings

| Rule | Value | Source |
|---|---|---|
| `SOFT_WARN` threshold | `5` (warning triggers when remaining <= 5) | `src/lib/rate-limit-warn.ts:18` |
| Buckets tracked | `messages_hour`, `messages_day`, `likes_hour`, `likes_day` | `rate-limit-warn.ts:20` |
| Duplicate guard | Per-bucket-per-session `warnedThisSession` Set | `rate-limit-warn.ts:22,107-108,122-123` |
| Evaluation priority | Tightest bucket (closest to cap) is warned first | `rate-limit-warn.ts:72-74` |
| Returns null if `remaining > SOFT_WARN` or `remaining <= 0` | No warning | `rate-limit-warn.ts:77` |
| Reset on sign-out | `resetRateLimitWarnings()` | `rate-limit-warn.ts:132` |

---

## 9. Messaging

### 9.1 sendMessage Flow

| Step | Logic | Source |
|---|---|---|
| 1. Moderation check | `moderateMessage(content)` — if not OK → return `ERROR_MESSAGE_MODERATION` | `chat.store.ts:404-407` |
| 2. Sender self-check | If own `receive_messages === false` → return `ERROR_SENDER_MESSAGES_DISABLED` | `chat.store.ts:412-414` |
| 3. Free-tier gate | `gateSendMessage()` — if not allowed → show limit dialog, return `ERROR_MESSAGE_FREE_LIMIT` | `chat.store.ts:419-423` |
| 4. Optimistic insert | Temp message with `temp-{timestamp}-{random}` ID, shown instantly | `chat.store.ts:429-438` |
| 5. Server insert | `supabase.from('messages').insert({ conversation_id, sender_id, content })` | `chat.store.ts:472-476` |
| 6. On success | Replace temp with confirmed message, `noteSentMessage()`, fire-and-forget `maybeWarnMessageQuota()` | `chat.store.ts:518-563` |
| 7. On failure | Mark temp as `sendFailed: true`, map DB error to user-friendly message | `chat.store.ts:478-515` |

### 9.2 Pagination & Caching

| Constant | Value | Source |
|---|---|---|
| `MESSAGE_PAGE_SIZE` | `50` | `chat.store.ts:63` |
| `MESSAGE_CACHE_LIMIT` | `200` | `chat.store.ts:70` |
| `MAX_MESSAGE_ID_SETS` | `50` (prevents unbounded dedupe map growth) | `chat.store.ts:56` |
| Fetch order | `created_at` descending (server), reversed to chronological | `chat.store.ts:264-265,285` |
| `loadOlderMessages` | Uses `created_at < oldestReal.created_at`, page size 50 | `chat.store.ts:342-348` |
| Has-more detection | `returned.length === MESSAGE_PAGE_SIZE` | `chat.store.ts:289,359` |
| Cache persistence | SQLite via `replaceCachedMessages`/`getCachedMessages` | Various |

### 9.3 Conversation Management

| Rule | Logic | Source |
|---|---|---|
| Conversation IDs | Deterministic via `userLowId`/`userHighId` lexicographic ordering | `chat.store.ts:573-574` |
| `getOrCreateConversation` | Block check first, then lookup by `user_low_id`/`user_high_id`, else insert | `chat.store.ts:568-599` |
| `deleteConversation` | Optimistic local removal + `conversation_hidden` upsert (soft-delete) | `chat.store.ts:601-641` |
| `deleteMessage` | Hard delete (RLS ensures sender-only) + optimistic | `chat.store.ts:643-689` |
| `softDeleteMessageForSelf` | RPC `soft_delete_message_for_self` (row stays, filtered client-side via `deleted_for`) | `chat.store.ts:691-741` |
| `markMessagesRead` | Optimistic unread=0 + RPC `mark_conversation_read` | `chat.store.ts:743-784` |
| Inbound preview | `applyInboundMessagePreview` updates `last_message`, `last_message_at`, bumps `unread_count` | `chat.store.ts:786-815` |
| Real-time dedupe | `addMessage` uses O(1) Set lookup per conversation | `chat.store.ts:817-841` |

### 9.4 Error Constants

| Constant | Value | Source |
|---|---|---|
| `ERROR_RECIPIENT_MESSAGES_DISABLED` | "This person has turned off receiving messages in their settings." | `message-insert-errors.ts:9-10` |
| `ERROR_SENDER_MESSAGES_DISABLED` | "Your messages are turned off. Open Settings → Privacy and turn on Receive messages to send." | `message-insert-errors.ts:13-14` |
| `ERROR_MESSAGE_MODERATION` | "This message looks inappropriate. Please rephrase it." | `message-insert-errors.ts:16` |
| `ERROR_MESSAGE_RATE_LIMIT_HOUR` | "You're sending messages too fast. Please wait a bit and try again." | `message-insert-errors.ts:18-19` |
| `ERROR_MESSAGE_RATE_LIMIT_DAY` | "You've reached today's message limit. Please try again tomorrow." | `message-insert-errors.ts:20-21` |
| `ERROR_MESSAGE_FREE_LIMIT` | `'free_limit_reached'` | `message-insert-errors.ts:25` |
| `ERROR_MESSAGING_BLOCKED` | "Messaging isn't available because one of you blocked the other." | `message-insert-errors.ts:27` (from `UI_TOAST.openChatBlocked`, `copy.ts:29`) |

**DB error discrimination keys:**
- Recipient disabled: code `23514`, key `recipient_messages_disabled`
- Sender disabled: code `23514`, key `sender_messages_disabled`
- Blocked: code `23514`, key `messaging_blocked_between_participants`
- Rate limit: code `23P01`, key `rate_limit:messages:hour|day|free`

— `message-insert-errors.ts:29-65`

---

## 10. Discovery Feed

**RPC `fetch_discover_profiles_page`** — `20260519120000_discover_feed_rpc.sql:3-86`

| Parameter | Type | Default | Bounds | Source |
|---|---|---|---|---|
| `p_viewer_id` | uuid | (required) | — | `line:4` |
| `p_gender` | text | null | — | `line:5` |
| `p_min_age` | int | 18 | clamped to [18, 100] | `line:6,37` |
| `p_max_age` | int | 100 | clamped to [p_min_age, 100] | `line:7,38` |
| `p_country` | text | null | — | `line:8` |
| `p_state` | text | null | — | `line:9` |
| `p_city` | text | null | — | `line:10` |
| `p_religion` | text | null | — | `line:11` |
| `p_online_only` | boolean | false | — | `line:12` |
| `p_verified_only` | boolean | false | — | `line:13` |
| `p_exclude_liked` | boolean | true | — | `line:14` |
| `p_limit` | int | 20 | clamped to [1, 50] | `line:15,35` |
| `p_offset` | int | 0 | clamped to >= 0 | `line:16,36` |

**Online cutoff:** `now() - interval '15 minutes'` (a user is "online" if `last_seen` within 15 min) — `line:29`

**Filtering logic (WHERE clauses):** — `line:47-77`
1. Exclude self (`p.id <> p_viewer_id`)
2. `show_in_discover = true`
3. `avatar_url is not null` (must have a photo)
4. Gender filter (optional)
5. Country / state / city filters (optional)
6. Religion filter (optional)
7. `verified = true` if `p_verified_only`
8. `online_status = 'online'` AND `last_seen >= 15 min cutoff` if `p_online_only`
9. `birthdate is not null`
10. Age range via birthdate clamping
11. **Block exclusion:** `NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id=viewer AND blocked_id=profile) OR (blocker_id=profile AND blocked_id=viewer))`
12. **Like exclusion (optional, default true):** `NOT EXISTS (SELECT 1 FROM likes WHERE from_user_id=viewer AND to_user_id=profile)`

**Order:** `last_seen desc nulls last, p.id` — `line:75`

**Covering index:** `idx_profiles_discover_listing` on `(show_in_discover, last_seen desc)` including `avatar_url, online_status, birthdate, gender, country, state, city, religion, verified, full_name, online_visible` — `20260518120000_speed_review_db_perf.sql:173-187`

---

## 11. Blocking

| Rule | Value | Source |
|---|---|---|
| Function | `hasSymmetricBlockBetween(userA, userB)` | `src/lib/block-queries.ts:14-16` |
| Implementation | Delegates to `isBlockedRelationship(userA, userB)` | `block-queries.ts:15` |
| Fetch blocked peer IDs | `fetchSymmetricBlockedPeerIds(userId)` | `block-queries.ts:19` |
| SQL pattern | `OR(blocker_id.eq.{userId}, blocked_id.eq.{userId})` | `block-queries.ts:25` |
| UUID validation | Only proceeds if both IDs are valid UUIDs | `block-queries.ts:8,20` |

**Discover feed block exclusion:** Both directions checked — `viewer blocks profile` OR `profile blocks viewer` — `discover_feed_rpc.sql:63-67`

---

## 12. Content Moderation

**7 slur patterns:** — `src/lib/moderation.ts:15-24`

| # | Pattern | Targets |
|---|---|---|
| 1 | `/\bn[i1l!][g9]+(er\|a\|ah\|ga)s?\b/i` | Racial slur |
| 2 | `/\bf[a@][g9]+(ot\|gy\|s)?\b/i` | Anti-LGBTQ slur |
| 3 | `/\bt[r]?ann(y\|ies)\b/i` | Transphobic slur |
| 4 | `/\bch[i1l!]nk(s\|y)?\b/i` | Ethnic slur |
| 5 | `/\bk[i1!]ke(s)?\b/i` | Ethnic slur |
| 6 | `/\bsp[i1!]c(s\|k\|ks)?\b/i` | Ethnic slur |
| 7 | `/\bwetb[a@]ck(s)?\b/i` | Ethnic slur |
| 8 | `/\bretard(s\|ed)?\b/i` | Ableist slur |

**5 solicitation/CSAM patterns:** — `src/lib/moderation.ts:28-34`

| # | Pattern | Targets |
|---|---|---|
| 1 | `/\bunder[\s-]?age\b/i` | Underage reference |
| 2 | `/\b(?:12\|13\|14\|15\|16\|17)\s*(?:yo\|y\/o\|year\s*old)\b/i` | Minor age claims |
| 3 | `/\bsend\s+(?:me\s+)?(?:nudes?\|pics?\|dick\|pussy)\b/i` | Sext solicitation |
| 4 | `/\bonlyfans?\b.*\blink\b/i` | Paid platform solicitation |
| 5 | `/\bsugar\s*dadd[yi]\b.*\bpay\b/i` | Transactional solicitation |

**Total patterns:** 13 (`ALL_PATTERNS` = 8 slurs + 5 solicitations) — `moderation.ts:36,56-57`
**Behavior:** Case-insensitive regex, checks slurs first, then solicitations — `moderation.ts:45-50`

---

## 13. Privacy & Safety

### 13.1 Privacy Toggles (Default Values)

| Toggle | Key | Default | Description | Source |
|---|---|---|---|---|
| Messages | `receive_messages` | `true` | "Turn off to pause incoming and outgoing messages" | `app/(settings)/privacy.tsx:47-49` |
| Show my profile | `profile_visible` | `true` | "Appear in Discover and Online for other members" | `privacy.tsx:59` |
| Incognito browsing | `incognito` | `false` | "Browse profiles without showing up in their Views. Pro only." | `privacy.tsx:77` |
| Blocked people | (navigation) | — | "Unblock or review who you've blocked" | `privacy.tsx:93-96` |

**Note:** `moderation_locked` is NOT a user toggle — it's set by the auto-shadowban system. When `true`, `profile_visible` toggle is disabled and a toast is shown — `privacy.tsx:55-71`

### 13.2 Account Deletion Flow

| Rule | Value | Source |
|---|---|---|
| Confirmation text required | `'I agree'` (must be typed exactly) | `app/(settings)/delete-account.tsx:14` |
| API endpoint | `supabase.functions.invoke('delete-account', { method: 'POST' })` | `delete-account.tsx:27-29` |
| Post-deletion | `supabase.auth.signOut()`, redirect to `/(auth)/welcome` | `delete-account.tsx:44,51` |
| Data erased | Profile/photos, conversations/messages, likes/connections, settings/preferences | `delete-account.tsx:121-125` |
| Final confirmation dialog | "This will permanently delete all your data including messages, likes, and your profile. This cannot be undone." | `delete-account.tsx:69-71` |

### 13.3 Report Reasons

| Value | Source |
|---|---|
| `'Fake profile'` | `src/lib/report-reasons.ts:3` |
| `'Scam'` | `report-reasons.ts:4` |
| `'Harassment'` | `report-reasons.ts:5` |
| `'Nudity'` | `report-reasons.ts:6` |
| `'Underage'` | `report-reasons.ts:7` |
| `'Other'` | `report-reasons.ts:8` |

Type: `UserReportReason` = union of above strings — `report-reasons.ts:11`

### 13.4 Shadowban (Auto-Moderation)

**Current threshold (latest migration `20260519110000_moderation_lock.sql`):**

| Rule | Value | Source |
|---|---|---|
| Shadowban threshold | `5` distinct reporters | `20260519110000_moderation_lock.sql:18` |
| Action on threshold | `profile_visible = false`, `moderation_locked = true` | `moderation_lock.sql:26-28` |
| Trigger | AFTER INSERT on `public.reports` | `moderation_lock.sql` |
| Backfill | Historical profiles with >=5 distinct reporters get locked | `moderation_lock.sql:74-84` |

**Historical thresholds (documenting changes):**
- `20260420010000_shadowban_via_user_settings.sql`: threshold = **3** — `shadowban_via_user_settings.sql:33`
- `20260515120000_shadowban_threshold_5.sql`: increased to **5** — `shadowban_threshold_5.sql:16`

### 13.5 Moderation Lock

| Rule | Value | Source |
|---|---|---|
| DB column | `user_settings.moderation_locked` (boolean, default false) | `moderation_lock.sql:4` |
| Users cannot clear lock | `enforce_user_settings_moderation_lock()` BEFORE UPDATE trigger | `moderation_lock.sql:41-62` |
| Error when clearing lock | `'Moderation lock cannot be cleared by users'` (errcode `42501`) | `moderation_lock.sql:51` |
| Error when re-enabling visibility while locked | `'Profile visibility is restricted by moderation'` (errcode `42501`) | `moderation_lock.sql:56` |
| Client-side behavior | Toggle disabled, toast: "Profile visibility is restricted. Contact support if you need help." | `privacy.tsx:62-68` |

---

## Appendix: Supabase Project Config

| Setting | Value | Source |
|---|---|---|
| `project_id` | `"africana"` | `config.toml:5` |
| API port | 54321 | `config.toml:10` |
| DB port | 54322 | `config.toml:29` |
| DB major version | 17 | `config.toml:36` |
| `max_rows` (API) | 1000 | `config.toml:18` |
| Storage file size limit | `"50MiB"` | `config.toml:112` |
| Edge runtime Deno version | 2 | `config.toml:366` |

## Appendix: Additional Migrations Referenced

- `20260518120000_speed_review_db_perf.sql` — rate limits + discover index + `conversation_unread_counts` RPC
- `20260419120000_launch_blockers.sql` — launch-blocker fixes (not read individually)
- `20260420000000_consolidated_security_perf_fixes.sql` — consolidated security/perf (not read individually)
