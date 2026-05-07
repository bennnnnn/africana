# Africana — engineering audit notes

Source: consolidated review (`improve.doc`). See git history for when items were addressed; some fixes ship in migration `20260426210000_improve_doc_security_and_integrity.sql` and related PRs.

---

1. God-screens — five files do too much
File
Lines
What it contains
app/(profile)/[id].tsx
2 662
Profile view + photo gallery + match modal + report + block + favourite + share + 39 hooks
app/(tabs)/me.tsx
1 049
Own profile + edit primitives + completion banner + various
app/(chat)/[id].tsx
944
Chat screen + composer + reactions + typing + delete-for-self/everyone + block flow
app/(auth)/onboarding.tsx
871
Multi-step onboarding
src/store/chat.store.ts
841
State + cache writes + moderation + error-mapping + analytics + notify side effects
app/(profile)/[id].tsx has 39 useEffect/useCallback/useMemo calls in one component. That's the canary. The fact that the chat-screen team already extracted useChatRealtime, useChatVisibilitySync, useKeyboardHeight, ChatScreenHeaderChrome, ChatPeerOverflowMenu, ChatComposerArea, ChatReactionPickerOverlay, ChatMessageRow, ChatMessageList, and chat-screen-styles.ts from the chat screen — and it's still 944 lines — tells you the same surgery is needed for the profile and "me" screens, which haven't started.
2. Duplicated cross-cutting logic
The same 5–10 lines appear in 3–6 places. A few of the worst:
"Fetch blocks for current user" pattern — at least 6 copies:
supabase.from('blocks').select('blocked_id, blocker_id')
 .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
discover.store.ts, online.tsx, use-likes-hub-controller.ts, block-queries.ts, social-actions.ts, notify Edge Function. There's already a symmetricBlockOrFilter() helper in block-queries.ts — only block-queries.ts itself uses it.
"Effective online status" ternary — duplicated ≥ 5 times (discover.store.ts, (chat)/[id].tsx x2, messages.tsx, online.tsx):
const effectiveOnline =
 raw.online_visible === false
 ? 'offline'
 : isUserEffectivelyOnline(raw.online_status, raw.last_seen)
 ? 'online'
 : 'offline';
Should be getEffectivePresence(user) in lib/utils.ts.
Auth bootstrap pair — await fetchProfile(uid); await fetchSettings(uid) lives in _layout.tsx, login.tsx, register.tsx → onboarding.tsx, the OAuth deep-link handler, plus the onAuthStateChange listener. Five copies, one bug-fix surface.
isProfileCompleteForDiscover(user) ? '/(tabs)/discover' : onboardingHrefFromSession(session) — also in 4 places. Should be redirectAfterAuth(user, session, router) helper.
Message error mapping: pgErrorBlob + isMessagingBlockedDbError + isRecipientMessagesDisabledDbError + isSenderMessagesDisabledDbError + mapMessagesInsertError (5 functions, 30 lines) all do string matching on PostgREST error blobs. Same pattern in discover.store.toggleLike for likes. Should be one mapPgErrorToUserMessage(err, domain) with SQLSTATE-driven dispatch.
3. Module-level mutable state — convenient but leaky
The codebase has roughly a dozen module-level Map/Set/let variables acting as per-process caches:
// discover.store.ts
let _cachedBlockedIds: string[] = [];
let _cachedLikedIds: Set = new Set();
let _cachedForUserId: string | null = null;
let _realtimeChannel: ... = null;
let _subscribed = false;
// chat.store.ts
const fetchConversationsPending = new Map >();
const fetchMessagesPending = new Map >();
const loadOlderPending = new Map >();
const messageIdSets = new Map >();
// app/(profile)/[id].tsx
const profileGalleryCache = new Map ();
const prefetchedPhotoUris = new Set ();
…plus more in active-chat.ts, profile-seed-cache.ts, typing-channel.ts, chat-cache.ts (dbAccessChain).
Two problems:
Cross-user leaks: nothing resets these on signOut(). User A's _cachedBlockedIds stays in memory when user B signs in on the same device.
Untestable: any unit test importing a store inherits the prior test's cache.
Move these into either (a) the store itself (useDiscoverStore.setState({ blocksCache: … })) so DevTools sees them and signOut clears them, or (b) a Cache class instance that can be reset.
4. Mixed styling — the README lies
package.json advertises NativeWind, tailwind.config.js and global.css exist… but 27 files use StyleSheet.create() including every auth screen, the settings screens, the chat components, the discover screen, and the messages screen. NativeWind classes are barely used. Pick one:
If you want NativeWind, kill the StyleSheet.create calls and convert. The benefit is real (less boilerplate, design tokens via Tailwind config).
If you want StyleSheet.create, drop NativeWind from deps and from the README.
Right now new contributors will be confused which way to do new screens.
5. Single-responsibility violations in auth.store.ts and _layout.tsx
auth.store.ts is named "auth" but does:
Auth state (session, user, settings)
Profile data fetching (which logically belongs to a useProfileStore or service)
Settings data fetching + upserting
Opportunistic legacy data normalization (the gender/interested_in write inside fetchProfile)
Birthdate → age computation with timezone-aware Date math
Side-effect plumbing (resetRateLimitWarnings on signOut)
Split: auth.store.ts for session only, profile.store.ts for profile, settings.store.ts for settings. signOut becomes Promise.all([signOutAuth(), resetProfile(), resetSettings(), resetCaches()]).
Similarly, app/_layout.tsx (312 lines) is a kitchen sink:
Auth bootstrap
Presence heartbeat (60 s ping + AppState handling)
Push registration
Welcome email queue
Deep-link handling (OAuth callback, password reset)
Notification tap/foreground listeners
Analytics init
Font loading
Splash screen management
Should be a stack of providers each owning one concern:. Right now everything is in one useEffect(() => { … }, []) block. That single effect has 7 different subscriptions to clean up — easy to break.
6. Magic numbers scattered across files
Different timing constants live in different places, with no central registry:
4000 (4 s poll) — (tabs)/_layout.tsx
60 * 1000 (heartbeat) — app/_layout.tsx
30 * 1000 (online refresh) — (tabs)/online.tsx
120 (conv-refresh debounce) — (tabs)/_layout.tsx
240 (activity-count debounce) — (tabs)/_layout.tsx
200/280 (likes-live debounces) — use-likes-live-channel.ts
3000/3500 (typing TTL — different in chat vs messages!) — use-chat-realtime.ts says 3000, messages.tsx says 3500
MESSAGE_PAGE_SIZE = 50, MESSAGE_CACHE_LIMIT = 200 — chat.store
LIKES_PAGE_SIZE, LIKES_LIST_STALE_MS — likes-screen constants
MAX_DIMENSION = 1600, JPEG_QUALITY = 0.82 — storage-image-upload
ONLINE_FRESHNESS_MINUTES = 3 — utils
Some are exported constants, some aren't. The two different TYPING_TTL values (3000 vs 3500) are an actual inconsistency bug — the chat header thinks "typing" goes away at 3 s but the inbox row thinks 3.5 s. Centralize:
// src/lib/timings.ts
export const TIMINGS = {
 presenceHeartbeatMs: 60_000,
 inboxPollFallbackMs: 60_000,
 onlineRefreshMs: 30_000,
 typingTtlMs: 3_000,
 realtimeRefreshDebounceMs: 200,
 countRefreshDebounceMs: 240,
 // …
} as const;
7. Three sources of schema truth
src/lib/supabase-schema.sql (249 lines, "original schema")
src/lib/supabase-migration.sql (450 lines, "migrate from original")
supabase/migrations/*.sql (31 files, the actual deploy path)
These overlap and drift: supabase-schema.sql still has email TEXT NOT NULL in the profiles table even though consolidated_security_perf_fixes.sql dropped it. Anyone bootstrapping a fresh DB from the schema file will have a column that production doesn't. Delete the two src/lib/*.sql files — supabase db reset against supabase/migrations/ is the source of truth.
8. Naming inconsistencies
File naming in src/components/chat/: ChatMessageRow.tsx, ChatComposerArea.tsx (PascalCase) sit next to chat-screen-styles.ts (kebab-case) in the same folder. Pick one.
LIKES_TAB_ORDER (constant) vs likesTabOffsets/likesTabHasMore (mutable module state) — the latter look like constants but mutate. Either rename to _likesTabOffsets to signal mutability or move them inside the controller.
WANT_CHILDREN_YES_NO is an awkward constant name. WANT_CHILDREN_OPTIONS?
Conversation.other_user (snake_case from DB) next to Message.listKey (camelCase, client-only). The mixed case isn't wrong — it tracks "from DB" vs "client-added" — but a comment per type would help.
useDiscoverStore.fetchUsers(userId, interestedIn?, reset?, agePref?) — 4 positional args, second & third optional. The call sites all pass them positionally, which is fragile (fetchUsers(user.id, user.interested_in, true, agePref)). Use one params object.
9. Hooks with too many parameters
useChatRealtime({
 conversationId, userId, messagesIdSetRef, peerTypingTimerRef, typingChannelRef,
 setPeerTyping, setReactions,
});
7 fields. The message mutation / read-marking actions live in the chat store, so the hook now calls `getChatStoreState()` directly and does not require wiring those functions through the screen. setPeerTyping/setReactions remain UI-owned state.
10. String-typed errors / events at the boundary
const blob = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`.toLowerCase();
if (b.includes('recipient') && b.includes('not accept')) ...
if (b.includes('messaging blocked between participants')) ...
if (blob.includes('rate_limit:messages:hour')) ...
The migrations correctly raise SQLSTATE codes (23P01, 23514, 28000), but the client matches English error message substrings. Any future tweak to a RAISE EXCEPTION 'recipient does not accept messages' string silently breaks the UX. Switch to:
const ERROR_CODES = {
 RATE_LIMIT_LIKES_HOUR: 'P0001:rate_limit:likes:hour',
 …
} as const;
if (err.code === '23P01' && err.message.startsWith('rate_limit:likes:hour')) …
…or, better, use RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '…', DETAIL = 'rate_limit:likes:hour' and dispatch on err.details.
11. Dead / legacy branches
getEffectiveAgePreferenceRange carries a "looksLikeLegacyDefault (40 or 60)" carve-out for old default values — add a delete-by date.
fetchProfile's opportunistic gender/interested_in normalization UPDATE is defensive code for a back-fill that's presumably done.
validation.ts exports validateOptionalText/validateOptionalWordList/validateOptionalHeight — verify they're still used and delete if dead.
These are usually fine to leave during a migration window, but each one needs a "delete by 2026-XX-XX" comment so it doesn't ossify.
12. Comments are excellent but occasionally over-explanatory
This is a minor and unusual complaint, but the comment density is very high — on a few hot paths the comment-to-code ratio is 1:1. Some of the long blocks would be better as JSDoc on the function or as an docs/ADR-001-presence.md. Example:
// Foreground ping. We deliberately fire this on every incoming
// message that ISN'T already on screen — even when the OS push from
// the `notify` Edge Function is also delivering one — because:
//
// 1. Realtime arrives in <1s; OS push is regularly 2–10s late.
// 2. Many EAS builds have FCM/APNs misconfigured, in which case
// this is the ONLY audible cue the user gets.
//
// The duplicate sound risk (push + local) is preferred over silence.
// If the user is actively viewing this conversation, we skip both
// sound and haptic because the message is appearing inline anyway.
if (isViewingConversation(message.conversation_id)) return;
Useful! But better lifted into docs/foreground-notifications.md or a JSDoc on a pingForegroundMessage() function. Inline 11-line preambles for 1 line of code start to bury the logic.
13. No tests
This is the single biggest clean-code red flag. Zero unit tests, zero snapshot tests, zero integration tests. For pure functions that beg for tests:
validation.ts — regex-driven, easy to break (e.g. the slur regex \bretard(s|ed)?\b will match in legitimate words; a test would catch that).
gender-match.ts, moderation.ts, profile-completion.ts, chat-list-build.ts, gender-match.normalizeInterestedInFromDb, utils.ts (calculateAge, isUserEffectivelyOnline, isUuidString, formatLastSeen, getEffectiveAgePreferenceRange, isLikesActivityNew).
The mapMessagesInsertError switchboard.
The parseMatchesRpcPayload legacy/jsonb dispatcher.
None of these touch network or React; all could have Jest tests in <2 hours total.
14. No central error/log reporting
console.error / console.warn is used 39 times across 15 files — but PostHog is integrated for events, and there's no Sentry or similar. In production, all those console errors disappear into the void. A 30-line lib/logger.ts wrapping console.* in dev and PostHog captureException in prod would tidy this up.
15. ESLint no-inline-styles is set to warn and is widely ignored
The Discover screen alone has dozens of inline style={{ … }} literals. Each creates a new object on every render. no-inline-styles rule is on; nothing's enforcing it. Either suppress per-line where intentional or honor the rule.
Cleanliness scorecard
Area
Grade
Notes
Type safety
A−
Strict mode, only ~9 as any casts
Naming consistency
B+
Good within layer; small inconsistencies cross-folder
Module organization
A−
Sensible layout; barrel exports could help
Comments
A
Explanatory and substantive (occasionally over-verbose)
DRY-ness
C+
Several duplicated patterns across stores/screens
Single responsibility
C
auth.store, _layout.tsx, (profile)/[id], chat.store violate hard
File sizes
C
5 files >800 lines, one at 2 662
Magic numbers
C
Scattered timings; one actual inconsistency (3000 vs 3500)
Error handling
B−
Mostly user-facing, but string-matched error blobs
Testability
F
No tests at all; module-level state hurts the testability that does exist
Schema source-of-truth
C−
Three overlapping SQL sources
Styling consistency
C
NativeWind advertised, StyleSheet used in practice
Dead code
B
Some legacy branches; not pervasive
Logging / observability
C
Console-only; PostHog integrated but underused
If I had a day to clean it up, in priority order
Decompose app/(profile)/[id].tsx into ~6 components: ProfileHeader, ProfileGallery, ProfileBio, ProfileActions, ProfileReportFlow, ProfileBlockFlow. Move the photo-cache helpers into lib/profile-photo-cache.ts.
Extract getEffectivePresence(user) and fetchSymmetricBlocks(userId) to lib/. Remove the 5–6 duplicate sites.
Centralize timings in lib/timings.ts. Fix the 3000 vs 3500 typing-TTL inconsistency.
Split auth.store into auth.store + profile.store + settings.store. Reset all module-level caches in a single resetAppState() helper called from signOut.
Promote the chat-store error-mapping switch into a typed lib/pg-errors.ts keyed on SQLSTATE + a structured error code string, not English text matching.
Delete src/lib/supabase-schema.sql + src/lib/supabase-migration.sql. Update README to point at supabase db reset.
Add Jest + 30 quick unit tests for the pure-function libs. Pre-commit hook to run them.
Pick a styling system (NativeWind or StyleSheet) and document it in CONTRIBUTING.md.
Wrap console. in a logger* that pipes to PostHog captureException in prod.
Provider-ize _layout.tsx — extract,,.
Net: this is a codebase a senior engineer can be productive in within a day or two, but a junior would be lost in (profile)/[id].tsx and chat.store.ts for a week. The bones are good; the surgery is mostly extraction + deduplication, not rewrite.
Block / unblock
What works
DB trigger enforce_recipient_accepts_messages (after 20260425120000) rejects messages when a symmetric block exists — server-enforced.
Triggers enforce_likes_respect_blocks and enforce_favourites_respect_blocks reject new likes/favourites between blocked pairs.
The notify Edge Function checks for symmetric blocks before sending push/email.
Likes hub client-side filter excludes blocked users from matches/received/viewers/favourites lists.
Block is symmetric for read access after 20260425120000 (either party can SELECT the row), so the recipient's chat composer can detect it.
Bugs / gaps
Block doesn't actually hide your profile from the blocked user. The README says "They won't see your profile or message you" and the in-app dialog Block ${name}? They won't see your profile or message you. says the same. But profiles SELECT RLS is USING (true) for any authenticated user, so the blocked user can still hit /(profile)/${blockerUuid} and see everything. The migrations should tighten this:
create policy "Public profiles are viewable by authenticated users"
 on public.profiles for select to authenticated using (
 not exists (
 select 1 from public.blocks b
 where (b.blocker_id = profiles.id and b.blocked_id = (select auth.uid()))
 or (b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id)
 )
 );
Block doesn't archive/hide the existing conversation for the blocker. After block, the chat thread still appears in the inbox; tapping in shows all old messages and a disabled composer. The schema already has a conversation_hidden table (with policies) — block should INSERT INTO conversation_hidden(user_id, conversation_id) so the chat falls off both sides' inboxes. Today, "Block + Delete chat" requires two separate user actions.
profile_views aren't gated by blocks. A blocked user can still view your profile and a row gets inserted into profile_views(viewer_id, viewed_id) — which then shows up in your Viewers tab. Add enforce_views_respect_blocks matching the likes/favourites pattern.
Inconsistent block-creation paths. social-actions.ts exports blockUser(), but (profile)/[id].tsx and (chat)/[id].tsx each call supabase.from('blocks').insert(...) directly, duplicating logic. Both call sites should go through blockUser() and benefit from the duplicate-key handler.
Unblock doesn't notify the other side. The other user's chat screen evaluates blockRelationshipActive only on chat init (hasSymmetricBlockBetween). After unblock, the other side keeps a disabled composer until they re-enter the chat. Acceptable, but a realtime patch via the blocks channel would close the loop.
Unblock has no action log. No track(EVENTS.BLOCK_REMOVED). You're tracking like/match/rate-limit events but not the most safety-relevant action.
Unblock fires supabase.from('blocks').delete().eq('id', blockId) directly in (settings)/blocked.tsx — same not-using-helper issue as #4.
Report
social-actions.tsLines 59-80
export async function reportUser(reporterId: string, reportedId: string, reason: string) {
 const { data: existingReport, error: existingError } = await supabase
 .from('reports').select('id').eq('reporter_id', reporterId)
 .eq('reported_id', reportedId).maybeSingle();
 if (existingError) throw existingError;
 if (existingReport) return 'exists' as const;
 const { error } = await supabase
 .from('reports')
 .insert({ reporter_id: reporterId, reported_id: reportedId, reason });
 if (!error) return 'inserted' as const;
 if (isDuplicateSocialError(error.message)) return 'exists' as const;
 throw error;
}
Bugs / gaps
Triple round-trip on report:
(profile)/[id].tsx handleReport() calls hasExistingReport() → 1 RT (just to gate opening the modal)
Modal opens, user picks reason, reportUser() runs select id from reports … → 2nd RT
Then insert into reports → 3rd RT
The UNIQUE(reporter_id, reported_id) constraint plus isDuplicateSocialError already handles "already reported" idempotently. Drop both pre-selects. One INSERT that returns 'inserted' or 'exists'.
Two shadowban triggers fire on every report. Look at the migrations:
20260419120000_launch_blockers.sql creates trigger auto_shadowban_on_report.
20260420000000_consolidated_security_perf_fixes.sql creates trigger trg_auto_shadowban_after_report_insert — but only drop trigger if exists trg_auto_shadowban_after_report_insert first; it doesn't drop the older auto_shadowban_on_report.
So both triggers run on every report insert, both call auto_shadowban_reported_profile(), both run the count(distinct reporter_id) query. Idempotent, but doubles the work. Drop the older one in a follow-up migration.
Report doesn't auto-block the reporter ↔ reported pair. After "Report for harassment" the reported user can still message the reporter, view their profile, like them, etc. UX expectation: report = also block. Add INSERT INTO blocks(blocker_id=reporter, blocked_id=reported) to the report flow (or do it in the trigger).
No moderation queue surface. The legacy supabase-migration.sql adds reports.reviewed BOOLEAN but the canonical migration doesn't. The docs/ADMIN_PANEL.md exists but no admin UI is in the repo. The 3-report shadowban is the only enforcement; a single bad report from a coordinated 3-user attack permanently shadowbans an innocent profile until manual intervention.
No "review" / appeal flow. Auto-shadowbanned users have no way to know they're shadowbanned (show_in_discover=false) or contest it.
Reports cannot be edited or withdrawn by the reporter. Once filed, locked-in. UX choice but worth noting.
Send message
chat.store.tsLines 415-578
sendMessage: async (conversationId, senderId, content, senderName = 'Someone') => {
 const moderation = moderateMessage(content);
 if (!moderation.ok) return { error: ERROR_MESSAGE_MODERATION };
 const { user: authUser, settings: authSettings } = useAuthStore.getState();
 const isOwnAccount = authUser?.id === senderId;
 if (isOwnAccount && authSettings?.receive_messages === false) {
 return { error: ERROR_SENDER_MESSAGES_DISABLED };
 }
 ...
 // Optimistic insert
 ...
 // ── Pre-flight checks ──
 // 1. Recipient profile.accepts_messages select
 // 2. Block check via hasSymmetricBlockBetween
 // 3. Real INSERT
 // 4. conversations UPDATE for last_message
}
Bugs / gaps
3 sequential pre-flight RTs gate the real insert. The optimistic message paints, then:
select accepts_messages from profiles where id=recipient (1 RT)
hasSymmetricBlockBetween → select id from blocks (1 RT)
Real insert into messages (1 RT)
update conversations set last_message=… (1 RT)
notifyUser Edge Function (1 RT)
notifyLifecycleEmail Edge Function (1 RT, separate call)
That's 6 sequential RTs per send. All three pre-flights are already enforced by DB triggers (enforce_recipient_accepts_messages covers all three). Drop them. The mapMessagesInsertError already converts trigger errors to friendly toasts.
last_message race: update conversations set last_message=NEW, last_message_at=NEW where id=… has no where last_message_at < NEW. If A and B send simultaneously, the network-arrival order decides which is "last". Latest writer wins by happenstance. Use where last_message_at IS NULL OR last_message_at < $newTs, or compute server-side via trigger on messages insert.
notifyUser + notifyLifecycleEmail are two Edge invocations. They could be one call with kind: 'activity' plus a piggyback campaign field — the function already handles both shapes.
No "send failed → retry" UX. On error, the message is rolled back from the local list — gone. Standard chat apps show a red "!" with retry tap. Optimistic-then-vanish is a poor offline UX.
outgoingMessagingDisabled and messagingDisabled and blockRelationshipActive are three separate booleans on the chat screen with overlapping meaning. Collapse into a single composerState: 'enabled' | 'disabled-self' | 'disabled-recipient' | 'blocked' enum.
Moderation regex is too narrow. The SLUR_PATTERNS and SOLICITATION_PATTERNS arrays in moderation.ts are tiny. False negatives will dominate. App Store review will accept this as "actively moderating UGC", but you should also add a server-side check (currently 100 % client-side; a custom client can bypass) and consider pg_trgm similarity for evasion variants. Plus add a few false-positive tests — \bretard(s|ed)?\b would flag "retardant".
Delete message
Bugs
RLS for messages DELETE is too permissive. After 20260424220000_allow_delete_conversations.sql:
create policy "Participants can delete messages"
 on public.messages for delete to authenticated
 using (
 exists (
 select 1 from public.conversations c
 where c.id = messages.conversation_id
 and (select auth.uid()) = any (c.participant_ids)
 )
 );
Either participant can DELETE any message in the conversation. The chat UI hides the "Delete for everyone" option for messages you didn't send, but a custom client can DELETE the other person's messages directly. Tighten back to using ((select auth.uid()) = sender_id) and use the soft_delete_message_for_self RPC for the recipient's "delete for me" path. (Soft-delete is already implemented and used; the broad RLS is no longer needed.)
Bulk delete fan-out: Promise.all(msgs.map(([messageId]) => deleteMessage(cid, messageId))) — N round trips for N selected messages. Should be one delete from messages where id = any($1) via RPC.
applyMessageUpdate doesn't react to deleted_for changes. When you "delete for me" on device A, device B (same user, second session) gets the realtime UPDATE but applyMessageUpdate only patches read_at and content:
if (m.read_at === message.read_at && m.content === message.content) return m;
So the soft-deleted message stays visible on device B until refresh.
No "delete for everyone" time window. Most messengers cap this at 1 hour or 24 hours. Currently you can hard-delete a 6-month-old message that the recipient has already read and screenshot-saved. Add a now() - created_at < interval '1 hour' check in the RLS / a new SECURITY DEFINER RPC.
Delete conversation
chat.store.tsLines 606-646
deleteConversation: async (conversationId) => {
 ...
 const { error: msgErr } = await supabase.from('messages').delete().eq('conversation_id', conversationId);
 ...
 const { error: convErr } = await supabase.from('conversations').delete().eq('id', conversationId);
 ...
}
Bug — this is the worst chat-side issue
The current "delete chat" hard-deletes the entire conversation for both users. Either party tapping the trash icon nukes:
All messages in the thread (across both participants)
The conversation row itself
…with no notice to the other side. They watch their entire conversation vanish.
The schema already has a conversation_hidden(user_id, conversation_id) table with proper RLS:
20260420000000_consolidated_security_perf_fixes.sqlLines 247-264
create policy "Participants can hide conversations for self"
 on public.conversation_hidden for insert to authenticated
 with check ((select auth.uid()) = user_id and exists (...));
deleteConversation should INSERT INTO conversation_hidden instead of hard-deleting, and the inbox query should filter conversation_hidden. The hard-delete should be reserved for delete_user() cascade.
Same with messages.delete() cascade in delete_user() — wipes the recipient's record of the conversation.
Like / unlike
Issues
5–7 round trips per like (already covered in performance review):
isBlockedRelationship pre-check (RT)
insert likes (RT)
select profiles full_name for sender (RT — but already in auth store!)
notifyLifecycleEmail (RT to Edge)
select id from likes mutual check (RT)
notifyUser (RT)
Should be one RPC like_user(p_to) returning { inserted, matched }.
No CHECK (from_user_id <> to_user_id) on likes. A user can like themselves. Same for favourites(user_id, favourited_id). blocks and reports correctly have the constraint; copy it.
Match-modal race is mostly handled (each side notifies the other once). But track(EVENTS.MATCH_CREATED) fires on both sides → matches get double-counted in PostHog. Fire only when inserted && matched server-side returns is_first_observer = true (use INSERT … ON CONFLICT DO NOTHING RETURNING xmax = 0 to detect that).
Unliking is silent. No notifyUser('unlike') (correct — you don't tell people they've been unliked) but also no track(EVENTS.LIKE_REMOVED) analytics in the right shape. You do track this — fine.
The _cachedLikedIds Set is mutated directly instead of going through a setter. Race-prone if called from two parts of the app concurrently.
Unlike doesn't unmatch. If A and B mutual-liked, then A unlikes, the match between them silently disappears from B's match feed (since get_matches requires both rows). B doesn't know they were "unmatched". Standard pattern: send a one-time "X is no longer a match" event, or at least keep the match in B's feed for X seconds with a "expired" badge. Currently it just vanishes.
Favourite / unfavourite
Issues
Extra RT every chat open for the heart icon state:
[id].tsxLines 352-355
supabase.from('favourites').select('id')
 .eq('user_id', user.id).eq('favourited_id', peer.id).maybeSingle()
 .then(({ data }) => setIsFavourite(!!data));
Fold into the chat-peer-context RPC.
addFavourite does a redundant block pre-check (RT) — same as likes. Drop, rely on trigger.
No (user_id <> favourited_id) CHECK.
Removing a favourite doesn't notify the other party (correct), but Notify settings have only notify_likes for both likes and stars (already noted). notify_favourites column missing — the Edge function has a TODO comment that hasn't been actioned.
The removeFavourite path in social-actions.ts doesn't return a result type — it throws. The chat screen wraps in try/catch and shows generic toast. Add 'removed' | 'not_found' return.
"Stop messages" toggle (receive_messages)
What works
DB trigger enforce_recipient_accepts_messages rejects both directions when either side has receive_messages = false — symmetric pause. Correct semantics.
Mirror column profiles.accepts_messages updated via sync_profile_privacy_from_user_settings trigger.
Issues
Symmetric semantics aren't surfaced clearly in UI. Privacy screen says "Turn off to pause incoming and outgoing messages" — good, that line is correct. But the chat composer just shows a vague "Messaging is unavailable" pill when blocked, conflating block, recipient-disabled, sender-disabled, and unknown. The error code from mapMessagesInsertError distinguishes them; surface that in the disabled-bar copy:
"You've turned off messaging in Settings → Privacy"
"This person isn't receiving messages right now"
"Messaging is unavailable for this conversation" (block)
No realtime push of state change to other side. When B turns off receive_messages, A's open chat composer doesn't disable until A tries to send. Subscribe the chat screen to UPDATEs on profiles filtered by id=eq.${peer.id} and patch accepts_messages live.
Pre-existing scheduled lifecycle emails (e.g. away_3d for B) still fire even after B turns off email notifications, per the screen copy:
"Welcome, first message, first like, and away emails still send even if email updates are off."
For welcome / first-time onboarding that's defensible. For "away_3d/7d/14d/21d/30d" re-engagement campaigns, that's a CAN-SPAM / GDPR violation — those are clearly marketing. Honor email_notifications for all away_* campaigns.
Notification preferences
Issues
favourite activity is gated by notify_likes, not its own column:
index.tsLines 113-119
const pushPrefEnabled =
 type === 'message' ? settings?.notify_messages !== false :
 type === 'like' ? settings?.notify_likes !== false :
 type === 'match' ? settings?.notify_matches !== false :
 type === 'view' ? settings?.notify_views !== false :
 type === 'favourite' ? settings?.notify_likes !== false :
 true;
The settings UI shows them as separate things ("Likes — someone likes your profile" vs no toggle for stars). Either add notify_favourites or rebrand the "Likes" toggle as "Likes & Stars".
Toggling a push pref ON re-registers push — good, refreshes the token / re-asks permission. But toggling it OFF doesn't remove push_token, so the token stays valid; if you decide to push them anyway, it'll deliver. That's intentional? If so, comment it. Otherwise null the token.
No "quiet hours" — push fires 24/7. For a global app spanning African + diaspora time zones, this matters.
iOS critical alerts aren't requested — fine for v1, just noting.
Match channel uses IMPORTANCE_MAX on Android — heads-up + bypass do-not-disturb for matches. App Stores can flag this for non-critical notifications. Tone down to HIGH.
Hide profile (profile_visible)
What works
Setting toggles user_settings.profile_visible; trigger mirrors to profiles.show_in_discover.
Discover, Online tab, and Likes hub queries all filter on show_in_discover.
Issues
"Hide" is partial. The toggle hides you from list views (Discover, Online) but not from:
Direct profile lookup by URL (/(profile)/{uuid} works because RLS = USING (true)).
The profile of someone who has previously seen you — they can still tap into your profile from their Likes hub, conversations, etc.
In-progress conversations (rightly so, but worth being explicit in the UI copy).
Toggling does NOT update existing realtime subscriptions — your profile stays in everyone's open Discover lists until they paginate or refresh. The discover-profiles-online channel only patches online_status, not show_in_discover. After a hide, the user still appears for ~minutes elsewhere.
Setting copy oversells: "Show my profile — Appear in Discover and Online." That's accurate, but users will read "Hide" as "invisible everywhere". Add a help link or tooltip explaining that direct links still work.
Hidden profiles' photos are still publicly accessible because the avatars bucket is public: true. URL leakage = visible.
Delete profile
What works
delete_user() RPC asserts auth.uid() matches deletion target.
Storage objects under ${uid}/ in both buckets are deleted before auth.users (correct ordering).
Delete-account UI handles three cases: email/password (signInWithPassword reauth), Google (signInWithGoogle reauth + identity match), and unknown (route to support).
revoke all + grant execute to authenticated is correct.
Issues
Apple sign-in not supported. App Store policy requires Apple Sign-in for any app offering Google sign-in. The delete-account flow only handles email and google providers — Apple users would fall into the "Contact support" branch. For an iOS dating app that's a likely TestFlight rejection.
Hard cascade-deletes destroy the recipient's chat history. Recipients see their thread half-empty (only their own bubbles remain). Tombstone instead — UPDATE messages SET sender_id='00000…', content='[deleted user]' WHERE sender_id = uid before deleting the auth row. Or migrate ownership to a sentinel 'deleted_user' profile.
No grace period. Many regulators (GDPR Art. 17) allow immediate deletion, but UX-wise a 14- or 30-day soft-delete (deleted_at column on profiles, restorable on next login) prevents accidental destruction.
No deletion confirmation email. Standard for high-stakes destructive actions.
delete_user() doesn't clean up module-level caches in the client (already noted in clean-code review).
Storage path coupling: delete_user() hardcodes the bucket names 'avatars' and 'profile-photos'. If a third bucket gets added later, dev needs to remember to update this RPC. Add a storage_buckets_to_clean table or fetch the list dynamically.
The signOut after delete is best-effort — if it fails, the client retains a now-invalid session token and may show "you're signed in" briefly. Force-clear session with setSession({access_token: null, refresh_token: null}) regardless of auth.signOut() result.
Delete picture (removePhoto)
photos.tsxLines 89-114
const removePhoto = (photoUrl: string) => {
 appDialog({
 ...
 onPress: async () => {
 const updatedPhotos = photos.filter((p) => p !== photoUrl);
 try {
 await updateProfile({
 profile_photos: updatedPhotos,
 avatar_url: updatedPhotos[0] ?? null,
 });
 } catch (e: unknown) { ... }
 },
 });
};
Bugs
The underlying storage object is never deleted. Removing a photo removes its URL from profile_photos[], but the JPEG sits in the avatars bucket forever, publicly readable by anyone who has the URL or scrapes the CDN. Add:
const path = extractStoragePath(photoUrl); // parse `${userId}/${ts}.jpg` from public URL
await supabase.storage.from('avatars').remove([path]);
Cost grows forever. Even users who delete every photo and leave the app keep paying you storage. The delete_user RPC does DELETE FROM storage.objects WHERE (storage.foldername(name))[1] = uid::text, which would clean these up — but only on full account deletion.
MAX_PROFILE_PHOTOS is enforced client-side only. A custom client can update profiles set profile_photos = array_of_50_urls. Add CHECK (cardinality(profile_photos) <= 6).
profile_photos URLs are user-controllable. No constraint that URLs must point at Africana storage. A user can put https://malicious.example/horror.jpg in the array. Add a CHECK constraint:
CHECK (
 profile_photos <@ ARRAY(SELECT unnest(profile_photos) WHERE unnest LIKE 'https://yourproject.supabase.co/storage/v1/object/public/avatars/%')
)
…or validate in a trigger / RPC.
Face validation runs client-side only. A custom client can bypass and upload non-face / NSFW. Server-side validation via Edge Function (Vision API or similar) is needed for App Store review.
Setting a new "main" photo only updates avatar_url — the file in storage is unchanged. Good. But setting main on a photo at index ≥ 1 reorders the array; the old avatar_url doesn't get re-derived from the array consistently. Verify there's no drift.
Photo upload is sequential. for (let i = 0; i < toUpload.length; i++) await uploadToAvatarsBucket(...). Three photos = 3 sequential network round-trips. Parallelize with Promise.all for the upload step (still serialize the final updateProfile).
Long-press to delete is undiscoverable. Tooltip says "Long press to remove" once at the top, but no per-photo affordance. A visible × button on hover/tap would be more discoverable.
Profile views (related to "incognito")
This is a flow you didn't mention but is part of the social loop:
Recording is automatic — opening a profile inserts a row into profile_views(viewer_id, viewed_id). There's no opt-out.
No "browse incognito" toggle for premium users (the upgrade screen mentions "platinum" plan but no perks are wired). For a dating app, this is table-stakes.
Views ignore blocks — already noted, missing a enforce_views_respect_blocks trigger.
The notify_views toggle defaults to false — good. But the profile_views row is still recorded, just not push'd — which means the viewer can be enumerated by the viewed user even if they hadn't enabled push. Consistent with most dating apps.
Cross-cutting issues
Issue
Affected flows
Severity
Pre-flight RT before write that's already enforced server-side
block, like, favourite, message, report, hide
P2 — speed
Self-reference not constrained (X likes X, X favourites X)
likes, favourites
P2 — data hygiene
Hide-from-Discover doesn't actually hide profile from anyone
hide profile
P1 — privacy promise
Block doesn't auto-hide existing conversation
block
P2 — UX
Delete chat hard-deletes for both parties
delete conversation
P0 — destructive UX
Delete message RLS too permissive (any participant)
delete message
P0 — integrity
Delete user wipes recipient's chat history
delete account
P1 — UX/data
Delete photo leaves orphan storage objects
delete picture
P1 — cost & privacy
Two shadowban triggers fire per report
report
P3 — perf
Report doesn't auto-block
report
P1 — safety UX
Lifecycle "away" emails ignore email_notifications
notification settings
P1 — compliance
Apple Sign-in unsupported in delete flow
delete account
P1 — App Store risk
notify_favourites missing, falls back to notify_likes
notification settings
P3 — UX
Match modal/notify race double-counts in analytics
like
P3 — analytics
Hard-delete cascade leaves orphan FlatList items mid-paint
delete account, delete conversation
P3 — UI
What I'd fix first
Make "Delete chat" use conversation_hidden instead of hard-deleting for both parties. The table and RLS already exist; just wire it up.
Tighten messages DELETE RLS back to using ((select auth.uid()) = sender_id). Soft-delete-for-self uses an RPC, so the broad policy isn't needed.
Add block-aware filtering to the profiles SELECT policy. Without it, "block" is a marketing word, not a feature.
Auto-block on report (or at least offer "Block this person" as a default-on checkbox in the report modal).
Delete the storage object when removePhoto runs.
Drop the older auto_shadowban_on_report trigger so reports don't double-fire.
Add CHECK (from_user_id <> to_user_id) on likes, (user_id <> favourited_id) on favourites.
Honor email_notifications for away_* campaigns — that's the compliance issue.
One like_user(p_to uuid) returns jsonb RPC that does insert + mutual-check + returns {inserted, matched, is_first_observer}. Eliminates 4 RTs and the analytics double-count.
One get_chat_peer_context(p_conversation_id uuid) returns jsonb RPC returning {peer, liked_by_me, favourited_by_me, blocked, accepts_messages}. Eliminates 4–5 RTs on every chat open and dedup'es a lot of social-state code.
Apple Sign-in support in delete-account before iOS submission.
The good news: every one of these is a small, surgical fix. The schema is already well-designed for most of them — the soft-delete table, the SECURITY DEFINER RPC pattern, the trigger framework. Most issues are "wired up the wrong primitive" rather than "needs a new system".

High-priority issues
1. notify Edge Function does not authorize the caller (push & email impersonation)
index.tsLines 55-172

Deno.serve(async (req) => {

 ...

 const payload: NotifyPayload = await req.json();

 ...

 const { type, recipientId, senderId, senderName, extra } = payload;

 ...

 // uses supabaseAdmin (service role) for everything

});

The function uses supabaseAdmin (service role) and reads senderId, senderName, recipientId, campaign straight from the request body. Supabase's default verify_jwt=true only proves the caller has some valid JWT — it does not pin senderId === jwt.sub. So any signed-in user can call:

supabase.functions.invoke('notify', {

 body: { type: 'match', recipientId:, senderId:, senderName: 'Real Name' }

});

…to make a victim receive a push/email that looks like it's from someone they didn't actually match with. They can also force kind: 'campaign', campaign: 'first_message' to spam lifecycle emails. Fix:

Read the JWT from the Authorization: Bearer … header (or use the user-scoped supabase client created from the request) and assert caller.sub === senderId.

Better: trigger pushes from DB events (insert on messages / likes via pg_net or a webhook) so the client can never fabricate them.

2. Activity email HTML is not escaped
index.tsLines 146-160

const recipientName = recipient.fullName ?? 'there';

const html = `

 

 Hi ${recipientName}, 

 ${template.body}. 

 ...

`;

escapeHtml exists in _shared/email-lifecycle.ts and is used by renderEmailHtml, but the activity email path interpolates raw recipientName and template.body (which embeds senderName). Both come from user-controlled profiles.full_name. Most mail clients sanitize, but this is still XSS-by-email and breaks rendering for legitimate names with &/<. Route both paths through escapeHtml / renderEmailHtml.

3. profiles is fully enumerable by any authenticated user
20260420000000_consolidated_security_perf_fixes.sqlLines 93-94

create policy "Public profiles are viewable by authenticated users"

 on public.profiles for select to authenticated using (true);

Combined with the heartbeat writes, every signed-up user can scrape the entire member directory plus last_seen/online_status. The discover query does the visibility filtering client-side, but RLS doesn't. For a dating app this has stalker-safety implications:

A blocked user can still query the blocker's row directly and watch their last_seen.

"Hide profile from Discover" (show_in_discover=false) doesn't actually hide the profile from anyone who knows the UUID.

Tighten the SELECT to exclude rows where the viewer is blocked or the row owner has show_in_discover=false, e.g.:

using (

 not exists (

 select 1 from public.blocks b

 where (b.blocker_id = profiles.id and b.blocked_id = (select auth.uid()))

 or (b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id)

 )

 and (

 show_in_discover = true

 or id = (select auth.uid())

 or exists (select 1 from public.likes where ... ) -- e.g. matched

 )

)

…or move profile reads through a SECURITY DEFINER RPC that applies the visibility rules.

4. conversations.participant_ids array has no integrity constraints
participant_ids UUID[] allows [a], [a,a], [a,b,c], etc. There's no UNIQUE on the unordered pair, so a double-tap race in getOrCreateConversation can produce two conversations between the same two users — and the next .maybeSingle() on .contains([a,b]) will throw PGRST116. Suggested fixes:

Normalize: a conversation_participants(conversation_id, user_id) join table with FK + composite PK.

Or, for two-party only: CHECK (cardinality(participant_ids) = 2 AND participant_ids[1] <> participant_ids[2]) + a unique index on (LEAST(p1,p2), GREATEST(p1,p2)).

5. Discover scales poorly past a few thousand users
No index on profiles.last_seen, despite being the discovery sort key and the freshness filter (.gte('last_seen', getOnlineFreshnessCutoffISO())). Add CREATE INDEX idx_profiles_show_last_seen ON profiles (show_in_discover, last_seen DESC) WHERE avatar_url IS NOT NULL; (partial index matches your discover predicates).

Blocked-IDs filter is sent as a URL query string: query.not('id', 'in', '(${blockedIds.join(',')})'). With ~1k blocks the URL exceeds practical mobile HTTP limits. Move filtering server-side via a SECURITY DEFINER RPC.

Realtime subscription has no filter: subscribeToOnlineStatus listens to every UPDATE on profiles table-wide. Every heartbeat from every user fans out to every connected client. Add filter: 'id=in.(uuid1,uuid2,…)' scoped to currently-rendered users.

Heartbeat writes to profiles every 60s per active user — and the BEFORE UPDATE trigger enforce_profile_privacy_columns re-reads user_settings on every write. Consider a separate presence(user_id, last_seen) table with no triggers, or use Supabase Realtime presence channels (no DB write at all).

Medium issues
addMessage's messageIdSets Map in chat.store.ts never gets cleaned up — long sessions across many threads slowly leak memory. Drop entries when a conversation is removed from state.

Module-level caches in discover.store.ts (_cachedBlockedIds, _cachedLikedIds, _cachedForUserId, _realtimeChannel, _subscribed) and the in-flight Maps in chat.store.ts are not cleared on signOut. If user A signs out and user B signs in on the same device, B can momentarily inherit A's caches/realtime channel. Reset them in the auth store's signOut.

fetchProfile issues an opportunistic UPDATE on profiles every cold start for legacy rows where gender/interested_in differ from normalized values. Once the data is back-filled, drop the write or guard it on a server-side migration.

enforce_recipient_accepts_messages picks "the recipient" with LIMIT 1 from participant_ids. Fine for two-party today; a footgun if group chats are ever added. Add a comment + cardinality(participant_ids) = 2 assertion.

delete_user() cascade-deletes messages of the deleted user, leaving recipients' threads half-empty (only their own bubbles remain). Consider tombstoning instead — replace sender_id with a sentinel and content with '[deleted]' so the recipient's chat history stays coherent.

validatePassword requires only 6 chars:

validation.tsLines 22-28

export function validatePassword(value: string): ValidationResult {

 if (!value) return { valid: false, message: 'Password is required.' };

 if (value.length < 6) return { valid: false, message: 'Use at least 6 characters.' };

 if (!LETTER_RE.test(value)) return { valid: false, message: 'Add at least one letter.' };

 if (!NUMBER_RE.test(value)) return { valid: false, message: 'Add at least one number.' };

 ...

}

Bump to 8 minimum (12 ideal). Supabase Auth has its own minimum; align them.

Avatar bucket is public: true with paths ${userId}/${ts}.jpg. Once uploaded, the URL is permanent and contains the userId in plaintext. Consider random UUID filenames at minimum, or signed URLs for verification selfies (the verification path currently writes selfies into the same public avatars bucket — selfies should not be world-readable).

Foreground notification listener auto-navigates in app/_layout.tsx:

_layout.tsxLines 164-175

notifReceivedSub.current = Notifications.addNotificationReceivedListener((notification) => {

 ...

 if (data?.conversationId) router.push(`/(chat)/${data.conversationId}`);

 ...

});

This yanks users out of whatever screen they're on as soon as a notification arrives. Standard UX is to navigate only on tap (the response listener), and just show a banner / update a badge in foreground.

Email enumeration on register: returning "An account with this email already exists. Try signing in instead." lets anyone probe whether someone is on the app. For a dating app this is a privacy concern. Generic copy plus a link to "Forgot password?" preserves UX.

supabase client is created at module scope with no fallback if env vars are missing. If EXPO_PUBLIC_SUPABASE_URL is unset in a build, you'll get an opaque crash on first call. Add a boot-time guard.

Schema-of-truth duplication: src/lib/supabase-schema.sql and src/lib/supabase-migration.sql overlap with — and can drift from — the canonical migrations under supabase/migrations/. Pick one. The CLI workflow (supabase db reset) is the source of truth; the src/lib/*.sql files should be deleted or auto-generated via supabase db dump.

Small / nitpicks
useRef (null) for notification subscriptions — type as Notifications.Subscription | null.

signInWithGoogle throws an Error('User cancelled') and callers do a magic-string match; use a typed error class.

Constants.appOwnership === 'expo' is the right Expo Go check today but is being deprecated in favor of executionEnvironment.

ESLint rule @typescript-eslint/no-explicit-any is warn and there are several as any casts (e.g. discover.store.ts realtime payload) — bump to error and fix the few sites.

signOut does best-effort UPDATE profiles … offline then auth.signOut(). If the network update fails, the session still tears down — fine, but currently unwrapped; add try/catch and unconditionally proceed to auth.signOut().

Mixed styling: NativeWind classes in some screens, StyleSheet.create in others (e.g. login.tsx, register.tsx). Pick one to keep the design tokens centralized.

Mixed state primitives: Zustand stores plus LikesHubContext. Document why or migrate.

No tests. For a launch product, at minimum add unit tests for validation.ts, gender-match.ts, moderation.ts regexes (especially the slur list to prevent false positives), and getOrCreateConversation race behavior.

SOLICITATION_PATTERNS has \bretard(s|ed)?\b in the slur list — not a slur in the legal/protected-class sense; consider relabeling, and revisit the false-positive surface (e.g. "fag" matches in legitimate words rarely, but chink matches "chink in the armor"). Worth adding tests.

README mentions src/lib/supabase-schema.sql as the way to set up Supabase; the actual canonical setup is supabase db push against supabase/migrations/. Update the README so new contributors don't run the stale schema file.

Suggested priority order to fix
Edge Function notify caller authorization (P0 — security, customer-trust).

HTML escape the activity email path (P0 — defense-in-depth).

Tighten profiles SELECT RLS to honor blocks + show_in_discover (P0 — privacy).

Conversation uniqueness + cardinality constraints (P1 — data integrity).

last_seen index + filtered realtime subscription + scale-out plan for blocked-IDs filter (P1 — scale).

Avatars/verification bucket separation + signed URLs for selfies (P1 — privacy).

Module-level cache reset on signOut + messageIdSets cleanup (P2 — correctness).

Foreground notification UX, password length, email-enumeration copy (P2 — UX/privacy polish).

Tests + README accuracy + src/lib/*.sql removal (P3 — maintainability).

Want me to dig deeper into any specific area — e.g. write the patch for the notify Edge Function authorization, sketch the normalized conversation_participants migration, or audit the chat realtime/typing code paths in more detail?

Top performance bottlenecks (ranked by impact)
1. The 4-second conversation poll (single biggest bandwidth hog)
_layout.tsxLines 163-175

const poll = setInterval(() => {

 useChatStore.getState().fetchConversations(user.id).catch(() => {});

}, 4000);

return () => {

 clearInterval(poll);

 if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);

 if (channelRef.current) supabase.removeChannel(channelRef.current);

};

Every 4 seconds, while the user is on any tab (so essentially the entire foreground session), fetchConversations runs. And fetchConversations is not cheap:

chat.store.tsLines 151-200

const { data, error } = await supabase

 .from('conversations')

 .select('*')

 .contains('participant_ids', [userId])

 ...

const [profilesResult, unreadResult] = await Promise.all([

 otherUserIds.length > 0

 ? supabase.from('profiles').select(PROFILE_LIST_SELECT as '*').in('id', otherUserIds)

 : Promise.resolve({ data: [] as User[] }),

 conversationIds.length > 0

 ? supabase

 .from('messages')

 .select('conversation_id')

 .in('conversation_id', conversationIds)

 .is('read_at', null)

 .neq('sender_id', userId)

 : ...

]);

That's 3 round trips × 15/min = ~45 round trips per minute per user, just for the inbox. The unread-counter pulls every unread message row and counts in JS — for a heavy user with 200 unread, that's 200 rows over the wire every 4s. And the realtime channel directly above this poll already subscribes to INSERT on messages and INSERT/UPDATE on conversations. The poll is fully redundant on a working network.

Plus on every poll, fetchConversations writes a full SQLite snapshot:

chat.store.tsLines 203-207

try {

 await replaceCachedConversations(userId, conversationsWithUsers);

} catch (e) {

 console.warn('[chat-cache] replaceCachedConversations failed:', e);

}

replaceCachedConversations does DELETE FROM cached_conversations WHERE user_id = ? then re-INSERTs every row in a transaction — every 4s, even when nothing changed.

Fix:

Delete the poll. Realtime + the messages.tsx AppState 'active' listener and useFocusEffect are already enough.

If you want a paranoid fallback, set the interval to 60 s and only run when the realtime channel reports CHANNEL_ERROR / TIMED_OUT (you already have the hook; turn it into the only path).

Make realtime patch the conversation in place instead of re-fetching. The INSERT messages payload already contains conversation_id, content, sender_id, created_at — that's enough to update last_message, last_message_at, and increment unread_count locally. No SQL needed.

Persist to SQLite only when the snapshot actually changed (cheap shallow-equal on the new array).

Realistic savings: −40 round trips/min/user plus the SQLite write storm.

2. Unfiltered global realtime subscriptions (fan-out scales with all users, not yours)
Three separate channels are subscribed to table-wide with no filter, so every event for every other user in the system streams to your client and is filtered in JS:

discover.store.tsLines 324-348

_realtimeChannel = supabase

 .channel('discover-profiles-online')

 .on(

 'postgres_changes',

 { event: 'UPDATE', schema: 'public', table: 'profiles' }, // ← no filter

 (payload) => { ... },

 )

 .subscribe();

_layout.tsxLines 206-226

activityChannelRef.current = supabase

 .channel(`tab-activity:${user.id}`)

 .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {

 const row = payload.new as { to_user_id?: string };

 if (row.to_user_id === user.id) scheduleRefetch(); // ← server-side filter would do this

 })

 .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favourites' }, ...)

 .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_views' }, ...)

 .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_settings' }, ...)

 .subscribe();

use-likes-live-channel.tsLines 37-56

.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {

 ...

 if (row.to_user_id === userId) scheduleReloadAll();

})

.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_views' }, ...)

.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favourites' }, ...)

The profiles UPDATE channel is the worst — every 60-second heartbeat from every user globally fans out to every client. With 10 k DAUs, that's ~10 k events/min streamed to every device just to be discarded by JS.

Fix: add server-side filters everywhere:

{ event: 'INSERT', schema: 'public', table: 'likes', filter: `to_user_id=eq.${userId}` }

{ event: 'INSERT', schema: 'public', table: 'favourites', filter: `favourited_id=eq.${userId}` }

{ event: 'INSERT', schema: 'public', table: 'profile_views', filter: `viewed_id=eq.${userId}` }

{ event: 'UPDATE', schema: 'public', table: 'user_settings', filter: `user_id=eq.${userId}` }

For the profiles discover channel, scope to currently-rendered IDs:

{ event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=in.(${visibleIds.join(',')})` }

…and re-subscribe when the visible set changes (or use Supabase Realtime presence channels, which don't write to the DB at all — see #3).

3. Heartbeat writes to profiles every 60 s
_layout.tsxLines 44-64

async function setOnlineStatus(userId: string, status: 'online' | 'offline') {

 await supabase

 .from('profiles')

 .update({ online_status: status, last_seen: new Date().toISOString() })

 .eq('id', userId);

}

async function pingLastSeen(userId: string) {

 await supabase

 .from('profiles')

 .update({ last_seen: new Date().toISOString() })

 .eq('id', userId);

}

const ONLINE_HEARTBEAT_MS = 60 * 1000;

Every active user writes one row to profiles per minute. Each write fires the BEFORE-UPDATE trigger enforce_profile_privacy_columns, which re-reads user_settings to mirror three booleans onto the row:

supabase-migration.sqlLines 407-436

CREATE OR REPLACE FUNCTION public.enforce_profile_privacy_columns()

RETURNS TRIGGER ...

DECLARE

 vis boolean; acc boolean; onl boolean;

BEGIN

 SELECT COALESCE(s.profile_visible, true), ... INTO vis, acc, onl

 FROM public.user_settings s WHERE s.user_id = NEW.id;

 ...

So each heartbeat = 1 UPDATE + 1 SELECT against user_settings + a realtime publication entry that streams to every connected client (per #2). With N concurrent users, that's 2 × N queries/min plus N² realtime fan-out events/min. This is the #1 thing that won't scale.

Fix options (pick one):

Best: drop heartbeat-to-DB entirely, use Supabase Realtime presence (channel presence.track({ user_id })). Zero DB writes, derives "online" from connected clients. Gives you typing-indicator-grade latency for free.

Cheap: split presence to its own table presence(user_id PK, last_seen) with no triggers and no RLS publication entry (don't add it to supabase_realtime). Heartbeat writes a single tiny row. Discover uses a join or a SECURITY DEFINER RPC.

Quickest: drop the privacy-mirror trigger from last_seen-only updates by gating it on WHEN (NEW.show_in_discover IS DISTINCT FROM OLD.show_in_discover OR ...). Halves the work per heartbeat.

4. Auth bootstrap fires fetchProfile + fetchSettings 2–3× per login
The same pair of fetches happens in every auth path, sequentially:

_layout.tsxLines 120-135

await fetchProfile(session.user.id);

await fetchSettings(session.user.id);

_layout.tsxLines 198-212

const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

 setSession(session);

 if (session?.user?.id) {

 const uid = session.user.id;

 void fetchProfile(uid).catch((e) => console.error('fetchProfile (auth change)', e));

 void fetchSettings(uid).catch((e) => console.error('fetchSettings (auth change)', e));

 ...

login.tsxLines 51-73

const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

...

await fetchProfile(session.user.id);

await fetchSettings(session.user.id);

const { user } = useAuthStore.getState();

if (isProfileCompleteForDiscover(user)) {

 router.replace('/(tabs)/discover');

}

Login flow:

signInWithPassword → 1 RT

fetchProfile → 1 RT (sequential)

fetchSettings → 1 RT (sequential)

onAuthStateChange fires SIGNED_IN → fetchProfile again + fetchSettings again (2 more RTs)

onAuthStateChange fires TOKEN_REFRESHED every hour → fetchProfile + fetchSettings again (2 more RTs each token refresh, ad infinitum)

Same in Google sign-in, register/onboarding, and the OAuth deep link path.

Fix:

Promise.all([fetchProfile, fetchSettings]) in every place — they're independent. Halves bootstrap latency.

In onAuthStateChange, only refetch on event === 'SIGNED_IN' || event === 'INITIAL_SESSION'. Skip TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY.

Remove the duplicate fetchProfile/fetchSettings from login/register/Google/deep-link callers — let the auth listener be the single source of truth. (Or keep those and remove from the listener, but pick one.)

5. Opening a chat = 5–8 round trips
In the cold-open path:

[id].tsxLines 350-355

useEffect(() => {

 if (!user || !peer) return;

 supabase.from('favourites').select('id')

 .eq('user_id', user.id).eq('favourited_id', peer.id).maybeSingle()

 .then(({ data }) => setIsFavourite(!!data));

}, [user?.id, peer?.id]);

[id].tsxLines 347-347

useEffect(() => { if (user) fetchLikedUserIds(user.id); }, [user?.id]);

[id].tsxLines 418-447

const [convResult] = await Promise.all([

 supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle(),

 fetchMessages(conversationId),

 markMessagesRead(conversationId, user.id),

]);

...

if (convResult.data) {

 const otherId = convResult.data.participant_ids.find(...);

 if (otherId) {

 const { data: raw } = await supabase

 .from('profiles')

 .select(PROFILE_LIST_SELECT as '*')

 .eq('id', otherId)

 .maybeSingle();

 ...

 if (await hasSymmetricBlockBetween(user.id, otherId)) {

Plus:

useChatRealtime does a 4th query: select message_id, user_id, emoji, messages!inner(conversation_id) from message_reactions to backfill reactions.

useChatVisibilitySync re-runs fetchMessages + markMessagesRead.

fetchLikedUserIds re-pulls all likes for the user (to compute "did I like this peer?" — a question that needs 1 row, not N).

Round trips on every cold chat open: fetchMessages + markMessagesRead + favourite check + likes (whole table) + block check + reactions backfill ± conversation row + peer profile = 5–8.

Fixes:

Don't re-fetch all likes to answer "do I like this person?" — query the single row: .select('id').eq('from_user_id', user.id).eq('to_user_id', peer.id).maybeSingle(). Or include liked flag in a single peer-context RPC.

Replace 3–4 of these with one SECURITY DEFINER RPC: get_chat_peer_context(p_conversation_id uuid) returning { peer: profile_row, liked_by_me: bool, favourited_by_me: bool, blocked: bool, accepts_messages: bool }. One RT instead of four.

useChatVisibilitySync should not duplicate fetchMessages — gate on "first foreground after backgrounding".

6. fetchUsers does 4 round trips on a fresh Discover load
discover.store.tsLines 147-170

if (reset || _cachedForUserId !== userId) {

 const [blocksRes, likedRes] = await Promise.all([

 supabase

 .from('blocks')

 .select('blocked_id, blocker_id')

 .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),

 supabase

 .from('likes')

 .select('to_user_id')

 .eq('from_user_id', userId),

 ]);

 ...

}

Followed by the main profiles query, then potentially a 4th "padding with liked users" query. And the blocked-IDs filter is sent inline in the next query as a comma-separated URL list:

discover.store.tsLines 184-191

if (blockedIds.length > 0) {

 query = query.not('id', 'in', `(${blockedIds.join(',')})`);

}

if (likedIds.size > 0) {

 query = query.not('id', 'in', `(${[...likedIds].join(',')})`);

}

For a power user with 1 k blocks/likes, that URL is 36 KB+ which (a) is sent on every range(...) page, (b) is parsed on the server every page, and (c) on iOS gets close to the practical HTTP URL limit.

Fixes:

Single SECURITY DEFINER RPC discover_feed(p_filters jsonb, p_offset int, p_limit int) that does the join in SQL and returns the page. 1 RT per page instead of 2–4.

Move blocked-IDs into a blocks join (or a session-scoped temp set) instead of round-tripping IDs.

The likes-fallback path is opportunistic; either include it in the same RPC or skip on slow networks.

7. Unread count is computed by pulling every unread row
chat.store.tsLines 175-191

unreadResult is:

 supabase

 .from('messages')

 .select('conversation_id')

 .in('conversation_id', conversationIds)

 .is('read_at', null)

 .neq('sender_id', userId)

...

const unreadCounts = new Map ();

for (const row of (unreadResult.data ?? []) as { conversation_id: string }[]) {

 unreadCounts.set(row.conversation_id, (unreadCounts.get(row.conversation_id) ?? 0) + 1);

}

Every conversation list refresh transfers N rows where N = total unread messages across all your chats. Combined with the 4 s poll (#1), that's N × 15 rows/min over the wire just to compute counts.

Fix: denormalize. Either:

Add conversations.unread_count_for(p_user uuid) bigint SECURITY DEFINER + a single grouped RPC: SELECT conversation_id, count(*) FROM messages WHERE ... GROUP BY conversation_id — server-side aggregation, returns ≤N rows where N = #conversations.

Or maintain a conversation_unread(conversation_id, user_id, count) table updated by INSERT/UPDATE triggers. Realtime can then patch counts without fetching anything.

8. Online Now polls every 30 s + refetches blocks every time
online.tsxLines 172-184

useFocusEffect(

 useCallback(() => {

 if (!initialLoadDone.current) return;

 void fetchOnlineUsers();

 const refreshTimer = setInterval(() => {

 void fetchOnlineUsers();

 }, 30 * 1000);

 return () => clearInterval(refreshTimer);

 }, [user]),

);

online.tsxLines 126-160

const { data: blocks } = await supabase

 .from('blocks')

 .select('blocked_id, blocker_id')

 .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

...

let query = supabase.from('profiles').select(PROFILE_LIST_SELECT as '*')...

Two RTs every 30 s. Realtime is already streaming profiles UPDATEs from #2 (currently table-wide). Drive this from local state instead of polling.

9. notifyUser/notifyLifecycleEmail always make an extra getSession() round trip
notifications.tsLines 219-230

export async function notifyUser(params: {...}): Promise {

 try {

 const { data: { session } } = await supabase.auth.getSession();

 if (!session) return;

 await supabase.functions.invoke('notify', { body: params });

 } catch {

 ...

 }

}

getSession() hits AsyncStorage and (when the JWT is near expiry) the network for refresh. supabase.functions.invoke already attaches the JWT internally — the gate is a no-op. Drop it.

Also: every like/message triggers notifyUser + notifyLifecycleEmail fire-and-forget. That's 2 separate Edge Function invocations per event — collapse the lifecycle email into the activity invocation since the function already handles kind: 'campaign'.

10. toggleLike issues 3 extra RTs after every tap
discover.store.tsLines 427-441

const { data: senderProfile } = await supabase

 .from('profiles').select('full_name').eq('id', fromUserId).single();

const senderName = senderProfile?.full_name ?? 'Someone';

void notifyLifecycleEmail({...});

const { data: mutual } = await supabase

 .from('likes').select('id')

 .eq('from_user_id', toUserId).eq('to_user_id', fromUserId).maybeSingle();

Sender's full name is already in the auth store — read it from useAuthStore.getState().user.full_name instead.

Mutual-like check could be folded into the INSERT via a single SECURITY DEFINER RPC like_user(p_to uuid) returns jsonb returning { inserted, matched, daily_count }.

The two notifyUser/notifyLifecycleEmail calls into the Edge Function are also 2 RTs each (function invoke + email RT). Keep the user RT off the hot path; void is good but they share network bandwidth on slow connections.

11. useFocusEffect on the Likes hub re-runs all the boot fetches
use-likes-hub-controller.tsLines 283-303

useFocusEffect(

 useCallback(() => {

 if (!user) return;

 void fetchActivityCountsRef.current();

 void loadTabRef.current(activeTabRef.current, false);

 void supabase

 .from('user_settings')

 .select('likes_seen_at, views_seen_at, favourites_seen_at, matches_seen_at')

 .eq('user_id', user.id)

 .maybeSingle()

 .then(...);

 }, [user?.id]),

);

Every time the user navigates to the Likes tab (e.g. comes back from a profile), three RTs:

activity_unseen_counts RPC

loadTab (which kicks off blocks select + the tab's query)

user_settings *_seen_at select

The seen_at columns rarely change — read them once on mount and patch on markTabSeen. Don't re-fetch on every focus.

12. messages.tsx AppState listener duplicates the tab layout's fetcher
messages.tsxLines 164-172

useEffect(() => {

 const sub = AppState.addEventListener('change', (next: AppStateStatus) => {

 if (next === 'active' && appStateRef.current !== 'active' && user) {

 fetchConversations(user.id);

 }

 ...

});

Plus the focus effect:

messages.tsxLines 176-180

useFocusEffect(

 useCallback(() => {

 if (user) fetchConversations(user.id);

 }, [fetchConversations, user?.id]),

);

…and the tab layout's 4 s poll. So foregrounding while on the messages tab can fire fetchConversations 3× in 100 ms (deduped by the in-flight Map, but still a wasted dedup attempt). Pick one.

13. messageIdSets Map leaks memory across the session
chat.store.tsLines 26-27

/** O(1) duplicate guard for addMessage — keyed by conversationId. */

const messageIdSets = new Map >();

Never cleared. After many chats, this is a permanent residency growth. Drop entries on deleteConversation/signOut/conversation removed from state.

14. subscribeToOnlineStatus can't unsubscribe properly across logouts
discover.store.tsLines 99-100

let _realtimeChannel: ReturnType | null = null;

let _subscribed = false;

Module-level. Not torn down on signOut. After a logout/login it keeps the prior session's RLS context until token-refresh.

15. fetchProfile does an opportunistic UPDATE on every cold start
auth.store.tsLines 76-83

const interested_in = normalizeInterestedInFromDb(gender, data.interested_in as string | null | undefined);

const profileFix: { gender?: Gender; interested_in?: typeof interested_in } = {};

if (gender !== data.gender) profileFix.gender = gender;

if (interested_in !== data.interested_in) profileFix.interested_in = interested_in;

if (Object.keys(profileFix).length) {

 void supabase.from('profiles').update(profileFix).eq('id', userId);

}

For legacy rows, this fires once and then is permanent. For migrated users it's a no-op fast-path. Two issues:

Even when profileFix is empty, the comparison still runs after every cold start. Fine in CPU but mostly dead code — delete it once the back-fill is verified done.

When it does fire, it triggers enforce_profile_privacy_columns (reads user_settings) and the realtime publication. Wasted bandwidth.

Indexing gaps that hurt query latency
profiles.last_seen — used as the discovery sort key (order('last_seen', { ascending: false })) and freshness filter (.gte('last_seen', cutoff)). No index. As profiles grows past ~10 k, every Discover page becomes a heap scan + sort. Add:

CREATE INDEX idx_profiles_show_last_seen

 ON public.profiles (show_in_discover, last_seen DESC)

 WHERE avatar_url IS NOT NULL;

Partial because that's the exact predicate Discover uses.

conversations.participant_ids — .contains('participant_ids', [userId]) requires GIN. Schema doesn't show one. Add:

CREATE INDEX idx_conversations_participants_gin

 ON public.conversations USING GIN (participant_ids);

messages (conversation_id, created_at DESC) — already there as idx_messages_conversation, good.

messages (conversation_id, read_at, sender_id) — would speed up the unread query in fetchConversations if you keep that approach. (Better: denormalize per #7.)

Bandwidth-y client patterns
PROFILE_LIST_SELECT has 35 columns. For grid cards you need ~10 (id, full_name, birthdate, gender, country, state, city, avatar_url, profile_photos[0], online_status, last_seen, online_visible, show_in_discover, accepts_messages, languages, religion). Define a PROFILE_CARD_SELECT allowlist and use it in Discover, Online, Likes, and Messages-list. Reduces per-row payload by ~60 % and avoids decoding fields you'll never render (bio, hobbies[], looking_for[], …).

Image prefetch is unbounded:

discover.tsxLines 125-131

if (urls.length > 0) void Image.prefetch(urls);

the viewable-items lookahead. On fast scroll you can issue dozens of concurrent fetches. Cap with a concurrency-3 queue.

Image upload compresses to 1600 px / q=0.82. For 2x density on a typical 4-inch portrait card that's overkill — 1080 px / q=0.78 looks the same. Saves ~30 % per upload.

Quick-win patches (in priority order)
Delete the 4 s poll in (tabs)/_layout.tsx. (Biggest single win.)

Add filter: to all 4 realtime channels (discover-profiles-online, tab-activity, likes-live, the messages INSERT in tab layout already filters by JS — push it server-side too).

Replace the heartbeat with Supabase Realtime presence, OR move last_seen to a no-trigger presence table.

Patch realtime → store instead of refetching: on INSERT messages, increment unread_count and update last_message. No SQL.

Promise.all profile + settings in all 4 auth paths; gate onAuthStateChange on SIGNED_IN only.

Replace fetchLikedUserIds on chat open with a single-row check.

One RPC for chat peer context, one RPC for discover feed, one RPC for likes hub state.

Drop the getSession() gate in notifications.ts.

Use useAuthStore.getState().user.full_name instead of refetching in toggleLike.

Add idx_profiles_show_last_seen + GIN on participant_ids.

Define PROFILE_CARD_SELECT for list views.

Tear down _realtimeChannel + clear messageIdSets / pending Maps on signOut.

If you want, I can write the SQL for the GIN + last_seen indexes, sketch the discover_feed and get_chat_peer_context RPCs, and patch out the 4 s poll as a single PR — say the word.
