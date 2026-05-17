# Africana — UX & product review

A walk through Africana from a user's perspective, organized flow-by-flow. Each finding cites the file it lives in so you can jump straight to the code. Severity is rated:

- **Critical** — blocks a meaningful slice of your audience, breaks a load-bearing flow, or invites App Store / Play rejection.
- **Major** — clearly hurts conversion, engagement, or trust; user-noticeable.
- **Minor** — polish, copy, or edge-case nit.
- **Praise** — worth keeping; called out so a refactor doesn't accidentally regress it.

The companion engineering audit in `docs/improve.md` covers code-quality, performance, and DB issues — this document deliberately stays on the user-facing side and avoids duplicating that ground.

---

## TL;DR — the five highest-leverage UX changes

1. **Open up gender & "interested in" to non-binary / everyone options.** Today onboarding hard-codes `male/female` for both, with no "everyone" or "non-binary" path. (Critical for App Store category guidelines; major for product reach.) — `src/constants/onboarding-screen-data.ts:44–53`, `src/lib/profile-completion.ts:10`.
2. **Add looking-for and language to Discover filters.** The README sells "filter by country, language, and values," but the filter sheet only offers online / age / religion / country. Users who joined for cultural / intent match can't act on it. — `src/components/discover/FilterSheet.tsx`.
3. **Cut weight from the profile, or hide it by default.** A required-feeling weight slider on a dating profile is a real conversion killer (especially for women) and is out of step with category norms. — `app/(tabs)/me.tsx:1091–1107`.
4. **Make the first message effortless.** There are no icebreakers, no profile-anchored reply prompts, no template starters — just an empty composer after the match. This is the single biggest reason matches go cold. — `src/components/chat/ChatComposerArea.tsx`, `app/(chat)/[id].tsx`.
5. **Address the "two reports = shadowban" trust problem and surface a contact route for support.** Combined with there being no in-app appeal, a small coordinated group can silently nuke any profile. Safety screen mentions "support@africana.app" but there's no in-app help / contact entry point from Settings → Account or Settings → Stay safe. — `docs/improve.md` section "Report"; `app/(settings)/safety.tsx:124–128`.

---

## 1. First impressions & onboarding

### What's working

- **Welcome carousel is on-brand and not pushy.** Three auto-rotating slides, no "skip" friction before the user knows what the app is. (`app/(auth)/welcome.tsx:17–33`)
- **Cultural framing is genuinely well-done.** Step 6 is literally titled "Your roots" with ethnicity + language pulled from country-specific data, and the diaspora path asks for "origin" before unlocking those options. This is the most distinctive thing about the product. (`app/(auth)/onboarding.tsx:737–840`, `src/lib/cultural-data/*`)
- **Face-detection on photo upload** rejects no-face / multiple-face images before save — strong fake-profile defense and a friendlier failure than a back-end reject. (`app/(auth)/onboarding.tsx:284–298`, `src/lib/face-detection.ts`)
- **IP-based location prefill** at step 5 saves a lot of typing. (`app/(auth)/onboarding.tsx:245–270`)
- **18+ gate is enforced client-side AND in the save path**, with both lower (18) and upper (120) sanity checks, and the user is bounced back to step 3 if invalid. (`app/(auth)/onboarding.tsx:338–357`)
- **First-name validation** uses a Unicode regex that correctly accepts names like "Ndèye", "Ọlúwasẹun", "Aimé" — most apps get this wrong for African names. (`src/lib/validation.ts:6–8`) **Praise.**

### Findings

#### Critical — Gender & "interested in" are cis-hetero only

`ONBOARDING_GENDER_OPTIONS` is `male` / `female` (`src/constants/onboarding-screen-data.ts:50–53`) and `ONBOARDING_INTEREST_OPTIONS` is `women` / `men` (`44–48`). `isProfileCompleteForDiscover` *requires* `user.gender === 'male' || user.gender === 'female'` before letting anyone into Discover (`src/lib/profile-completion.ts:10`). Implications:

- Non-binary / queer / questioning users have no honest way to use the product.
- The app cannot be marketed to LGBTQ+ Africans / diaspora, who are a meaningful slice of the audience and very underserved.
- App Store and Play Store reviewers increasingly probe dating apps on gender inclusivity. iOS in particular has rejected dating apps that don't offer at least a non-binary / "prefer not to say" path.

**Recommendation.** Add `nonbinary` and (optional) `other` to gender, and `everyone` to interested-in. If the matching algorithm can't yet act on "everyone," still let users pick it and silently fall back to a relaxed filter.

#### Major — "What I'm looking for" is asked but never filtered on

Onboarding step 4 forces at least one of relationship / marriage / friendship / pen-pal (`app/(auth)/onboarding.tsx:366–372`). The "pen pal" option in particular is wonderful for diaspora connection. But Discover filters never expose this (`src/components/discover/FilterSheet.tsx:84–144`), so someone looking for marriage sees the same grid as someone who picked pen pal. The signal you collected at signup is wasted at the most important moment.

**Recommendation.** Add a "Looking for" multi-select chip row to the filter sheet, default to the viewer's own set. Bonus: add an opt-in mode where Discover excludes profiles whose looking-for has zero overlap with yours.

#### Major — Step 6 ("Your roots") is silently skipped for diaspora users with no African origin

If the user lives outside Africa AND hasn't set an origin country, `showRootsStep` becomes `false` and the user finishes at step 5 (`app/(auth)/onboarding.tsx:140–146`). This is technically correct (no data to draw from) but the user is never *told* this — they just don't see "Your roots" and may not know the feature exists later. After onboarding they have to discover this themselves by editing their profile, where there's a "Set your origin first" empty state in the ethnicity modal (`app/(tabs)/me.tsx:1126–1164`) — good fallback, but discoverability is poor.

**Recommendation.** At step 5, when the user picks a non-African living country, add a one-line teaser: "Add an African origin to see ethnicity & language options for your heritage." The "Origin (optional)" field is there but its purpose isn't framed.

#### Major — Step 3 stacks too much above the fold

Step 3 puts DOB picker + gender chip row + interested-in chip row on one screen (`app/(auth)/onboarding.tsx:660–701`). On a small device with the keyboard up for the date picker, the user has to scroll inside an already-scrolling onboarding container to see the gender row. The error path here is also nasty: if `birthdate || gender || interestedIn` is missing, the alert says only "Please complete step 3" — not which field. (`app/(auth)/onboarding.tsx:335`).

**Recommendation.** Either split into 3a (DOB), 3b (gender + interested-in) or — if you want to keep one screen — surface inline validation for each field, the way step 1 does for the name input.

#### Major — Photo step shows no upload progress

`pickAndUploadPhoto` shows a hourglass icon when `photoUploading` is true (`app/(tabs)/me.tsx:545–551`) but the onboarding version just spawns `Promise.all(...uploadToAvatarsBucket(...))` with no per-photo indicator (`app/(auth)/onboarding.tsx:400–413`). If a user picks 6 photos on a slow connection, they see the "Continue" button disabled with no idea what's happening. The face-detection step happens *client-side first*, so during the upload phase there's no feedback loop.

**Recommendation.** Show per-photo states in `OnboardingPhotoGrid` (queued / uploading / done / failed), or at minimum render a progress count under "Continue" ("Uploading 2/4…").

#### Minor — Celebration screen wastes a great moment

Step 7 is `🎉 Welcome to Africana! Your profile is live.` (`app/(auth)/onboarding.tsx:544–565`). The user just spent 3-5 minutes filling out a profile, and the first thing they're told is to "enrich it anytime." This is the highest-attention moment in the funnel and you're using it to remind them to do more work.

**Recommendation.** Use this screen to either (a) immediately tee up the first action — "Tap here to see 47 people in Lagos right now" — or (b) showcase the first match-able profile front and center, the way Bumble does. The current copy is fine for late-stage retention but underused at this moment.

#### Minor — Terms of service consent is easy to miss

`AuthLegalConsentRow` is rendered below the bigger CTAs on both register (`app/(auth)/register.tsx:290–294`) and step 1 (`app/(auth)/onboarding.tsx:629–635`). The link to read the terms is technically there but small, and most users will tap "I agree" without reading. If you're shipping to the EU you'll want a stronger explicit-consent pattern (separate checkbox for marketing emails vs. terms), and the audit trail is being saved on `terms_accepted_at` (`onboarding.tsx:393–398`) — good — but the UX gives users no way to revisit/withdraw it.

---

## 2. Discover (the home tab)

### What's working

- **Grid is the right call** for a browse-based app. Two big cards per row, dense enough to compare, large enough to see faces.
- **NEW badge for accounts < 10 days old** (`src/components/discover/UserCard.tsx:29, 144–148`) is a smart engagement trick — newcomers get free attention, which combats the cold-start problem. **Praise.**
- **Long-press → QuickPreviewModal** is a delightful interaction — you can peek without losing your scroll position. (`src/components/discover/UserCard.tsx:109–113`, `src/components/discover/QuickPreviewModal.tsx`)
- **Header parallax and pull-to-refresh** feel native; the "All caught up" footer is friendlier than infinite-scroll-into-nothing. (`app/(tabs)/discover.tsx:90–107, 396–399`)
- **Online pulse animation** on the avatar dot is subtle and effective. (`UserCard.tsx:68–78`)
- **Skeleton cards on first load** instead of a spinner — proper modern feel. (`discover.tsx:316–320`)

### Findings

#### Major — Filter sheet is too thin given the cultural value prop

`FilterSheet` only exposes: Online Only, Age Range, Religion, and Country/State/City (`src/components/discover/FilterSheet.tsx:84–144`). Missing:

- **Languages spoken** — the strongest cultural axis you have, especially for diaspora.
- **Looking for** — already collected, see §1.
- **Has photos / Verified only** — both standard quality filters; "Verified only" would also make your verification flow more valuable.
- **Has children / Wants children** — table stakes for a marriage-oriented audience.

The "Filter (n)" affordance and active-filter chip row in the header are well-designed (`discover.tsx:168–199, 478–523`); they'll comfortably hold 2-3 more filters.

#### Major — Empty state is friendly but doesn't help

When no users match, you show "🌍 No members found · Try widening your filters" with a "Clear Filters" CTA (`discover.tsx:343–366`). It's a graceful failure, but it doesn't *do* anything for the user. If the active filter is "religion=Catholic AND country=Senegal AND age 30-32," the right move is to drop one constraint server-side and surface a "Showing nearby instead" banner. Right now the user has to know to widen which filter.

**Recommendation.** Implement a "broaden automatically" fallback: when the keyed filter returns zero, re-run with one less constraint and label the result. Better than dumping the burden on the user.

#### Minor — There's no signal of *why* a profile appears in your grid

For a non-swipe browse app, this is forgivable, but as competition for attention grows, even a tiny "shared language: Amharic" badge would help. The `commonHobbies` / `commonLanguages` machinery already exists on the profile detail screen (`app/(profile)/[id].tsx:1014–1026`) — promoting it to the card overlay is a small win.

#### Minor — Religion filter has no "Any" UX affordance

`SelectPicker` is clearable, but the chip in the header shows the religion *value* with no obvious way to broaden without opening the sheet. The current behaviour ("tap chip to clear") works once you know it; a tooltip or longer label ("Religion: Catholic — tap × to clear") would help.

#### Minor — Loading shows 8 skeletons but the actual page can fit ~6

A minor visual nit — the bottom of the skeleton grid gets clipped behind the tab bar. `Array.from({ length: 8 })` (`discover.tsx:317`) could be 6 for a cleaner load.

---

## 3. Profile view (looking at someone else)

### What's working

- **Telegram-style collapsing header.** Big hero photo → mini avatar + name + last-active pinned to top as you scroll. (`app/(profile)/[id].tsx:1214–1289`) Beautifully done.
- **Double-tap to like with heart burst.** Pure dopamine. (`[id].tsx:806–838, 766–797`) **Praise.**
- **Swipe-up at the bottom = next profile, swipe-down at the top = dismiss.** Genuinely native-feeling, and the "Up next" footer with a chevron-up tells users it's there. (`[id].tsx:639–677, 1842–1854`)
- **"You have in common" chip row** surfacing shared hobbies + languages (`[id].tsx:1599–1626`) is excellent and uses the data you spent onboarding collecting.
- **Quick Facts block** (Looking for · Speaks · Works as · Ethnicity) is dense without being a spec sheet (`[id].tsx:1531–1596`). Each row only renders when present, so empty profiles stay clean.
- **"More details" collapse** keeps the deep-dive sections opt-in (`[id].tsx:1675–1837`) — the default view drives a fast yes/no decision, which is what a profile view is for.
- **`isFavourite` ("star") is a true second-tier signal**, distinct from like, useful for "keep an eye on this one." Good product call.

### Findings

#### Major — "Send a message" can dead-end into a quota wall

The user double-taps to like → match modal pops → they tap "Send a message" → chat opens → they type → on send, `sendMessage` is gated by `gateSendMessage()` (`src/lib/free-quota.ts:71–78`) and they get a "You've used your 10 free messages today" dialog (`free-quota.ts:92–98`). The right place to surface this gate is *before* they type the message, not after. Free users find this frustrating; matches go cold for purely operational reasons.

**Recommendation.** When `gateSendMessage()` would deny, show a banner inside the chat composer ("9/10 daily messages used — last one") *before* the user composes, not after the send button is tapped.

#### Major — No icebreakers or starter prompts in chat

When a match opens, the chat is empty save for "Start a conversation" placeholder. There's nothing to prompt a first message — no profile prompts, no suggested openers, no "ask Amara about her trip to Lagos" hooks. Industry data is unanimous that ~40-60% of matches go un-messaged. For a culturally-oriented app, there's a layup here: auto-generate "Ask about Amara's roots in Wolayta" or "You both speak Yoruba — say hi in it." (`app/(chat)/[id].tsx`, `src/components/chat/ChatComposerArea.tsx`)

#### Major — Report flow finishes silently with no block prompt

After a successful report (`ReportUserModal.submit`, `src/components/ui/ReportUserModal.tsx:44–64`), the user sees a toast "Report sent" and the modal closes — they're still on the offender's profile. The reported user can still send them messages (until shadowban kicks in after 3 reports), and the reporter has to take the extra step of *also* blocking. UX expectation: reporting = the offender is now invisible to me.

**Recommendation.** Auto-block on report. Or, less drastically, end the report modal with "Also block this person?" toggle pre-checked.

#### Minor — Discover gate modal can ambush users from share links

`ProfileDiscoverGateModal` fires when a viewer has an incomplete profile and lands on someone else's via `needsDiscoverGate` (`[id].tsx:1036–1037`). This is the right product behavior — you want everyone who participates to have a complete profile — but if the user got there from a shared link or a notification tap, the modal is jarring with no context about what just happened.

**Recommendation.** Add a one-line preamble: "Complete your profile to message and like Amara." It's currently up to the modal itself to communicate this; make sure it does.

#### Minor — Activity label can flicker between "Online" / "Seen 1m ago" / "Offline"

`formatShortLastSeenLabel` is recomputed every render based on `Date.now()` (`[id].tsx:97–115`). On a profile where `last_seen` is right around the freshness boundary, you'll see the label flip as the viewer lingers on the screen. Not catastrophic but it can read as "is this person there or not?"

#### Minor — "Block" dialog message is technically inaccurate

`handleBlock` shows "They won't see your profile or message you" (`[id].tsx:1180–1191`). Per the engineering audit (`docs/improve.md` "Block / unblock"), profile RLS is `USING (true)` so blocked users can still hit your profile URL. This is a copy-vs-implementation gap that will bite when someone notices.

---

## 4. Likes hub

### What's working

- **Four-tab segmentation** (Matches / Likes / Views / Stars) is the right structure. (`src/screens/LikesHubScreen.tsx`, `src/constants/likes-screen.ts`)
- **Smart landing tab**: on first entry to `/likes` with no param, `pickLandingLikesTab` lands you on the first tab with unseen items (`src/constants/likes-routes.ts:14–19`). This is great — users always see the freshest activity first.
- **`isLikesActivityNew` "NEW" markers** per row based on per-tab `seen_at` (`LikesHubScreen.tsx:139, src/lib/utils.ts isLikesActivityNew`) means activity feels alive between sessions.
- **Views tab paywall is well-positioned**: shows the count ("3 people viewed you") but gates the identities behind Pro — strong upsell because the user knows there's value waiting. (`LikesHubScreen.tsx:157–180`) **Praise.**

### Findings

#### Major — "Likes" tab does not show whether you've already liked them back

When someone likes you, they appear in the "Likes" (received) tab. Tapping in goes to their profile, where you can like them back to spark a match. But the row itself doesn't tell you if you've already liked them or not — `LikesRow` shows `isMutual` only on non-`matches` tabs (`LikesHubScreen.tsx:144`), which is good, but the inverse case — "you liked them, awaiting their like" — isn't shown anywhere.

**Recommendation.** Show a small heart-with-check icon on rows in the "Likes" tab where you've already liked back. Otherwise the user has to remember.

#### Minor — Empty state for Matches is dating-app-passive

"No matches yet · Like someone who already liked you to spark a match" (`src/constants/likes-screen.ts:28–31`). This tells the user to wait for the right pre-existing condition. Better: route them to Discover with a CTA, or show a "Recently active members near you" rail.

#### Minor — "Stars" branding may confuse new users

The path is `/likes/stars` and the tab is "Stars" but the action is called "Favourite" everywhere else (`UI_TOAST.favouriteAdded`, `addFavourite`). The favourites/star inconsistency is also called out in `docs/improve.md` §13 of the engineering audit, but it has a UX surface too: the user has to learn that ⭐ = favourite. Just call them favourites (or just stars) — pick one.

---

## 5. Messages & chat

### What's working

- **Conversation row design is clean**: avatar with presence dot, name, time, last-message preview, unread badge. Typing indicator replaces the preview live (`app/(tabs)/messages.tsx:71–141`). The unread-row tinted background is a nice touch.
- **Search across name + message preview** is fast and obvious. (`messages.tsx:249–257, 302–327`)
- **Composer disabled-state variants** are well-thought-out: 4 distinct copies for `outgoing-off` / `blocked` / `peer-off` / `active` (`src/components/chat/ChatComposerArea.tsx`). The "Your messages are turned off. Open Settings → Privacy" copy is excellent because it tells the user how to fix it.
- **Realtime typing indicators with shared, ref-counted channels** so the indicator doesn't tear down when navigating between inbox and chat. (`messages.tsx:197–235`, `src/lib/typing-channel.ts`)
- **Re-fetch on AppState → active** catches missed messages while suspended. (`messages.tsx:171–179`)

### Findings

#### Critical — Delete-chat hard-deletes the entire thread for both sides

Long-press a row in the inbox → "Delete chat" → confirm → `deleteConversation` fires (`messages.tsx:270–300`), which hard-deletes all messages and the conversation row for BOTH participants (covered in `docs/improve.md` "Delete conversation"). From the *other* user's perspective, their entire conversation just silently vanishes. This is a trust-destroying surprise and inconsistent with every other messaging app, where "delete for me" is a unilateral hide.

**Recommendation.** Use the existing `conversation_hidden` table (the engineering audit notes it's already in place with RLS) so deletion is per-user. Reserve hard-delete for account deletion cascade.

#### Major — No retry UI for failed sends

When `sendMessage` errors (network blip, rate limit, recipient toggled off receive_messages while you were typing), the optimistic bubble is rolled back from the local list (`docs/improve.md` "Send message" item #4). The user sees their message vanish, no red ! marker, no retry. Standard chat affordance everywhere.

#### Major — No icebreakers or starter prompts (repeated from §3)

The single biggest improvement available to first-message conversion. Don't make people stare at a blank composer after a match.

#### Major — No conversation-level safety affordances

There's a `ChatPeerOverflowMenu` with block / report / favourite / unmatch options (`src/components/chat/ChatPeerOverflowMenu.tsx` — inferred from usage), but the entry point is a three-dot menu in the header. For an app aimed at women in the African diaspora (a higher-than-average romance-scam target population given the demographics involved), I'd surface "Report" more directly — a permanent "Are you being asked for money? Tap to report" hint above the composer on the first 1-2 messages, or a slow-pulse subtle hint until the first message is exchanged.

#### Minor — `formatConversationTime` "Yesterday" is timezone-sensitive

`now.subtract(1, 'day').isSame(then, 'day')` is local-time arithmetic but the timestamp is parsed via dayjs from the DB string (`messages.tsx:50–63`). At 11pm in West Africa, a message from "Yesterday" will flip back to its weekday name once the local rollover happens. Not high-stakes but inconsistent.

#### Minor — Chat empty state copy

When no messages yet, the row preview shows "Start a conversation" (`messages.tsx:127`). Once you tap in, the chat screen also shows a blank composer. There's no on-screen prompt actually saying "Say hi!" at the top of the message list. A single-line "You matched with Amara — say hi!" call-to-action would help dramatically (and is the natural surface for the icebreaker feature).

#### Minor — `formatConversationTime` uses `MMM D, YY` for old messages

Two-digit year format ("Mar 21, 26") looks like a date-vs-month-vs-year ambiguity. `MMM D, YYYY` is fine; the conversation is rarely so old that the column needs to be 2 chars shorter.

---

## 6. Own profile (the "Me" tab)

### What's working

- **Profile completion pill in the header** ("87%") with a tap-to-jump-to-next-missing-field interaction is great mechanic design. (`app/(tabs)/me.tsx:454–462`, `sectionForMissingKey`, `scrollToSection`)
- **Inline nudge under the bio** ("Add your Education to get more matches") with a chevron — much better than a generic completion bar buried in settings. (`me.tsx:655–668`)
- **Hero photo strip with "tap a photo to set it as your main picture"** caption (`me.tsx:572–581`) is friendly and discoverable.
- **Cultural data is reused on edit** — opening "Ethnicity" or "Languages" fetches the same country-specific options the user saw at onboarding (`me.tsx:1109–1180, 1182–1300`). The "Set your origin first" dashed-card fallback when ethnicity data isn't available is a beautifully thought-out empty state. **Praise.**
- **Online status badge floats on the hero photo** so users can confirm their visibility at a glance. (`me.tsx:531–539`)

### Findings

#### Critical — Weight as a profile field

There's a `weight_kg` slider (`me.tsx:1091–1107`). This is a major friction point for many users — most users won't want to share weight on a dating profile, and very few dating apps still ask for it. It also can read as objectifying for women in particular. The fact that weight is part of "Physical" alongside Height and Body Type doesn't help.

**Recommendation.** Remove weight, or at the very least demote it to an "Additional details" section that's clearly optional. If you keep it, consider an "Allow weight to appear on my profile" toggle so it's collected for filtering but not displayed.

#### Major — `getProfileStrength` weights culturally-loaded fields equally

The 9-item completion checklist (`src/lib/profile-completion.ts:30–41`) treats `photo` and `religion` and `hobbies` as equal weight. Empirically photo, bio, and one or two demographic basics are 90% of the lift; nudging users toward "complete your Hobbies" is going to chase the metric for its own sake.

**Recommendation.** Weight the items, and show different copy at different completion bands:
- 0-49%: photo + bio (the basics matter most)
- 50-79%: looking-for + height (decision-relevant)
- 80-99%: hobbies + extras (richness)

The next-missing chase doesn't have to go in the order the array is written in.

#### Major — No way to preview your profile as others see it

`/me` is an *edit* surface — every field has an edit affordance. There's no "View as a member would" button to see what other users actually see on `/(profile)/${myId}`. This matters a lot for a profile-driven product. Users tweak their photo / bio and want to see the result in the same shape strangers will.

**Recommendation.** Add a "Preview my profile" header button that routes to `/(profile)/${user.id}` with the read-only view.

#### Major — Bio has no character minimum and no examples

The bio modal is `maxLength={300}` with a character count, no minimum, no placeholder examples (`me.tsx:1001–1015`). For first-time profile creation this is a leading cause of single-word bios ("hi"). Even three tiny example chips ("Sundays at the market" · "Lifelong Eagles fan" · "First-gen Ghanaian-American") would be transformative.

#### Minor — Photo order isn't draggable

The Photos grid lets users add and long-press-to-remove (`me.tsx:935–987`), and the strip above lets you tap one to make it the main, but reordering between positions 2-6 isn't possible. For a dating app where the order is part of the story you tell, this is a real omission.

#### Minor — "Has children" / "Wants children" are independent toggles with no harmonized copy

"Has children: Yes/No" alongside "Wants children: <enum>" creates redundancy when the answer is "Yes, has." The interplay is fine but in the profile-view detail section both render unconditionally if set, leading to "Has children: Yes / Wants children: yes" which is conversationally redundant.

#### Minor — Empty-state copy uses an em-dash inconsistently

"Add a bio — it helps you stand out" uses an em-dash (`me.tsx:646–648`). "Add what you're looking for" doesn't. Minor consistency issue.

---

## 7. Settings, safety, monetization

### What's working

- **Settings hub is well-organized** — Privacy, Notifications, Premium & trust, Stay safe, Legal, Account (`app/(settings)/main.tsx`). Visual hierarchy with iconColor per item is clear without being noisy.
- **`SafetyScreen` is genuinely excellent.** Categorized "Before you meet" / "When you meet in person" / "Protect your information" / "If something goes wrong" tips, with a refreshingly direct "Never send money" tip that names the specific scam playbook. (`app/(settings)/safety.tsx`) The "If you're in immediate danger, call local emergency services" line is appropriate gravitas. **Praise — this is better than the equivalent in any tier-1 dating app I've seen.**
- **Delete account flow** is the right amount of friction: explicit "type 'I agree' to confirm" + final confirmation dialog + list of what gets deleted (`app/(settings)/delete-account.tsx:14, 67–77`). GDPR-compliant.
- **Data export** ("Download my data") in Account → JSON export (`app/(settings)/account.tsx:26–49`). Few apps do this proactively and it's a real trust signal.
- **Premium upgrade screen has two clean modes**: live RevenueCat paywall when `PAYMENTS_ENABLED`, in-app preview with "Notify me 🔔" when not. (`app/(settings)/upgrade.tsx`) **Praise** — most apps would just hide the upgrade page entirely; using it as a pre-launch teaser captures interest.
- **`showProGateDialog`** is the single source of truth for "this feature is Pro" prompts (`src/lib/pro-gate.ts`). Consistent CTA across the app.
- **Notification preferences are tasteful** — separate toggles for messages / likes / matches / views / email, no "send me everything" creep. (`app/(settings)/notifications.tsx:62–106`)

### Findings

#### Critical — Three-report shadowban + no in-app contact route

From `docs/improve.md` Report section: 3 distinct reporters → auto-shadowban (`show_in_discover = false`), the user has no notification this happened and no in-app appeal. Combined with no in-app help / support entry in Settings → Account or Settings → Stay safe (the only support route is the `support@africana.app` line on the Safety screen, line 128), an innocent user who's been brigaded has no way to surface the problem until they figure out their profile isn't appearing in Discover.

**Recommendation.**
- Add "Contact support" as a row in Settings → Account.
- When `show_in_discover` flips to false for a user, send them a polite in-app notification ("Your profile has been temporarily hidden after several reports. Tap to appeal.") and a deep link to a support form.
- Tighten the shadowban threshold so a coordinated 3-person brigade isn't enough.

#### Major — "Show my profile" hide-toggle is Pro-gated, hurting safety-minded free users

`Privacy > Show my profile` lets free users *enable* visibility but blocks them from *disabling* it without Pro (`app/(settings)/privacy.tsx:50–70`). The framing is "Hiding requires Pro" — but for a user being harassed or stalked, the ability to disappear from Discover is a safety feature, not a premium one. Apple's App Store review has specifically called this pattern out on dating apps.

**Recommendation.** Always allow hiding-self for free. Reserve the Pro upsell for *continuous* incognito ("browse without being seen in Views") which is `incognito` (`privacy.tsx:72–87`) — that one is a genuine premium feature.

#### Major — No in-app verification badge upsell

`PremiumTrustSettingsScreen` exposes "Profile verification — submit a selfie for a verified badge" (`app/(settings)/premium-trust.tsx:45–51`), but nothing in the rest of the app prompts users toward it. The `VerifiedBadge` shows on cards and chats when present (`src/components/ui/VerifiedBadge.tsx` used across `UserCard.tsx`, `chat/[id].tsx`), but free users have no nudge to do it themselves. The verification flow is built; let it pay off.

**Recommendation.** A one-time nudge on first-time messaging-someone: "Verified profiles get 2× more replies. Add yours — takes 30 seconds."

#### Minor — Settings text capitalization is inconsistent

"Premium & trust" (lowercase "t"), "Stay safe" (sentence case), "Privacy" (single word). Pick one: title case throughout, or sentence case throughout.

#### Minor — Notifications screen always re-registers on mount

`useEffect` calls `registerForPushNotifications(user.id)` every time the screen opens (`notifications.tsx:46–53`). The comment says this is intentional ("keep device token + Android channels fresh"), but if push permission was denied earlier, this silently fails and the user has no idea why their toggles aren't working. A "Notifications are off in iOS Settings — tap to open" affordance when permission is denied would close the loop.

#### Minor — "Manage subscription" row hidden until `PAYMENTS_ENABLED`

When payments go live, `presentCustomerCenter()` (RevenueCat) handles cancel/refund/restore (`premium-trust.tsx:36–44`). Today, while `PAYMENTS_ENABLED = false`, this row is hidden, which is correct. But when you flip the flag, users who joined via the share-reward Pro path (`src/lib/payments.ts:273–275`) have no obvious way to see their entitlement. Worth adding a "You have Africana Pro via share reward" row for that path.

---

## 8. Cross-cutting

### Copy & tone

- **Tone is warm and human** throughout. UI_TOAST messages use proper apostrophes (curly), and error copy actually tells you what to try ("Couldn't refresh. Try again."). Most apps default to robot-speak ("An error occurred"). **Praise.**
- **One inconsistency:** error copies are split across `UI_TOAST` constants (`src/constants/copy.ts`) and inline strings in screens. The `appDialog` calls in `register.tsx`, `onboarding.tsx`, and others duplicate similar copy. Centralizing in `copy.ts` would prevent drift.
- **`stay safe` vs `safety screen` vs `safety tips` vs `safety center`** — pick one term and use it everywhere.
- **"Africana" capitalization is consistent**, "Africana Pro" too. ✓

### Empty & error states

- Most empty states use `EmptyState` (`src/components/ui/EmptyState.tsx`) — primary-surface icon circle + title + description. Consistent and warm.
- **But:** Discover, Likes per-tab, and Messages each have their own bespoke empty states (`discover.tsx:343–366`, `likes-screen.ts:23–47`, `messages.tsx:365–374`). The Likes per-tab strings are tight and good, but Discover's standalone empty state isn't built on `EmptyState` and feels visually different.
- **Error states are inconsistent**: some show `cloud-offline-outline` with "Try again" button, some show `alert-circle-outline` toast. Standardize on the card pattern from `LikesHubScreen.tsx:73–84`.

### Accessibility

- **`accessibilityLabel` is set on most TouchableOpacities** — `UserCard.tsx:99`, `[id].tsx:1228, 1238, 1281`, etc. **Praise.** Most app codebases ignore this.
- **`accessibilityRole="header"`** on the Discover title (`discover.tsx:480`) — nice.
- **Color-only signals.** The "online" pulse uses `COLORS.online` (green). For color-blind users there's no shape or text alternative on the card — the dot is the only signal. (`UserCard.tsx:151–164`)
- **Font sizes** — the Quick Facts label is 11px (`pr.quickFactLabel`), and the share-rewards toast uses `FONT.xs`. WCAG AA wants 12px minimum for body text on mobile; you're at the boundary.
- **No `screenReader` testing artifacts.** I'd recommend a 30-min VoiceOver pass — particularly around the photo viewer's gesture-only navigation, which currently exposes "View photo 1, View photo 2..." but the swipe-to-next-profile is gesture-only.

### Loading & perf perceptions

- **Skeleton screens** are used in Discover (`SkeletonCard`), Messages (`SkeletonRow`), Likes hub (`SkeletonRow`), and Blocked users — consistent and modern. **Praise.**
- **Image prefetch logic** (`discover.tsx:136–144, 248–264`) is sophisticated — first screenful warmed on mount, next 6 cards warmed on scroll. The user-perceived "no fade flash" matters a lot.
- **One nit:** the profile photo viewer's swipe-to-next-profile (`[id].tsx:696–748`) doesn't prefetch the adjacent profile's hero photo when the user starts the gesture, so there's a momentary blank during the transition.

### Cultural fit

Africana's distinctive value is the cultural/diaspora angle, and the app delivers on it more than the README promises:

- The cultural data is country-specific (`src/lib/cultural-data/west-africa.ts`, etc.) with suggested + all languages per region.
- The placeholder names in the bio examples and onboarding name input ("e.g. Amara") feel right.
- The greeting on the welcome screen "Where African Hearts Connect" lands.
- Pen-pal as a `LookingFor` option is unusually inclusive for diaspora.

What's *missing* on the cultural front:

- **No multi-language UI** (the README mentions French, Swahili, Arabic, Amharic as roadmap). Right now, English-only. For an app whose target audience includes 200M+ francophone Africans, this is a meaningful gap.
- **No prayer / fasting / Ramadan context** in the family / religion section. Religion is just an enum.
- **No way to specify what a "Habesha", "Yoruba", "Igbo" user means by it** — the ethnicity field is a single value, but ethnic identity is often multi-faceted, especially for diaspora.

---

## Quick prioritization

| Priority | Item | Approx. effort |
|---|---|---|
| P0 | Add non-binary gender + "everyone" interested-in | 1 day |
| P0 | Fix delete-chat to be per-user via `conversation_hidden` | 1 day (DB infra already there) |
| P0 | Auto-block on report (or pre-checked toggle) | half-day |
| P0 | Add "Contact support" route in Settings | half-day |
| P1 | Add "Looking for" + "Language" + "Verified only" to Discover filters | 1-2 days |
| P1 | Build first-message icebreakers using profile + viewer overlap | 3-5 days |
| P1 | Drop weight from profile, or hide behind opt-in toggle | half-day |
| P1 | Free-quota gate visible BEFORE the user types, not after send | 1 day |
| P1 | Allow free users to hide their own profile | half-day (remove the gate) |
| P2 | "Preview my profile" affordance on Me tab | 1 day |
| P2 | Bio character minimum + 3-chip example library | half-day |
| P2 | Send-failed retry UI in chat | 1 day |
| P2 | Verification badge upsell on first message | 1 day |
| P2 | Show "you already liked back" state in Likes tab | half-day |
| P3 | Standardize empty states on `EmptyState` component | half-day |
| P3 | Multi-language UI (FR + AR + SW + AM) | weeks |
| P3 | Drag-to-reorder photos on Me tab | 1 day |

---

## What to keep at all costs (in priority of reluctance to lose)

1. The cultural data system + "Set your origin first" empty state — your most distinctive UX moment.
2. The collapsing Telegram-style profile header + swipe gestures — a real differentiator.
3. The Safety tips screen — exceeds the bar for the category.
4. Face-detection on photo upload — keeps the bar high.
5. The Likes hub's 4-tab landing-on-newest behavior — invisible but felt every session.
6. `appDialog` / `showProGateDialog` / `EmptyState` design system consistency — easy to lose in a redesign.
7. The "Notify me 🔔" pre-launch Pro screen — captures interest you'd otherwise lose.
8. Profile completion pill + next-missing nudge — engagement loop done right.
9. Unicode-tolerant first-name validation — most apps screw this up.
10. The warm copy throughout (`UI_TOAST`, dialog titles, "Choose a reason. We'll review it.") — voice is rarer than it should be.
