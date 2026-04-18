-- ============================================================================
-- 20260420000000_consolidated_security_perf_fixes.sql
--
-- Fixes audited via Supabase MCP on 2026-04-16:
--   1. auto_shadowban_reported_profile() trigger was missing on public.reports
--      (function existed; the create-trigger statement never landed). Result:
--      a profile with 3 distinct reporters was still discoverable.
--   2. profiles.verified / verification_status columns were missing, even
--      though the entire selfie-verification flow writes to them.
--   3. profiles.email is readable by every authenticated user via
--      "Public profiles are viewable by authenticated users" (USING true).
--      Email lives in auth.users; no need to duplicate it here.
--   4. profile-photos bucket has a broad SELECT policy that allows storage
--      object enumeration. Public buckets serve URLs without it.
--   5. 39 RLS policies call auth.uid() directly, causing per-row re-evaluation
--      at scale. Wrap as (select auth.uid()) so the planner caches it.
--   6. blocks/reports/favourites had two permissive policies for the same
--      role+action — dedup to one.
--   7. 6 foreign keys lack covering indexes.
--
-- Idempotent: re-runnable. The Supabase migration runner already wraps the
-- whole file in a transaction, so we don't add explicit begin/commit here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Auto-shadowban trigger + backfill
-- ----------------------------------------------------------------------------

drop trigger if exists trg_auto_shadowban_after_report_insert on public.reports;
create trigger trg_auto_shadowban_after_report_insert
  after insert on public.reports
  for each row execute function public.auto_shadowban_reported_profile();

update public.profiles p
set show_in_discover = false
where p.id in (
  select reported_id
  from public.reports
  group by reported_id
  having count(distinct reporter_id) >= 3
)
and p.show_in_discover is distinct from false;

-- ----------------------------------------------------------------------------
-- 2. Verification columns
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists verified boolean not null default false,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_verification_status_check;
alter table public.profiles
  add constraint profiles_verification_status_check
    check (verification_status in ('unverified','pending','approved','rejected'));

-- Keep the boolean flag in sync if anyone is already flipped to approved.
update public.profiles
set verified = true,
    verified_at = coalesce(verified_at, now())
where verification_status = 'approved' and verified is distinct from true;

-- ----------------------------------------------------------------------------
-- 3. Drop the leaking email column. Email lives on auth.users.
--    Edge functions read it via auth.admin.getUserById(); the client reads
--    it from session.user.email.
-- ----------------------------------------------------------------------------

alter table public.profiles drop column if exists email;

-- ----------------------------------------------------------------------------
-- 4. Storage: drop the broad SELECT policy on profile-photos.
--    Public buckets serve object URLs without an explicit SELECT row policy;
--    removing it stops listing/enumeration via the storage API.
-- ----------------------------------------------------------------------------

drop policy if exists "Profile photos are publicly accessible" on storage.objects;

-- ----------------------------------------------------------------------------
-- 5/6. Drop every RLS policy on touched public.* tables, then recreate with
--      (select auth.uid()) and no duplicates. Cleaner than ALTER POLICY
--      because we're also changing names/conditions.
-- ----------------------------------------------------------------------------

-- profiles -------------------------------------------------------------------
drop policy if exists "Public profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;

create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);

-- likes ----------------------------------------------------------------------
drop policy if exists "Users can view likes"      on public.likes;
drop policy if exists "Users can create likes"    on public.likes;
drop policy if exists "Users can delete own likes" on public.likes;

create policy "Users can view likes"
  on public.likes for select to authenticated
  using ((select auth.uid()) = from_user_id or (select auth.uid()) = to_user_id);
create policy "Users can create likes"
  on public.likes for insert to authenticated
  with check ((select auth.uid()) = from_user_id);
create policy "Users can delete own likes"
  on public.likes for delete to authenticated
  using ((select auth.uid()) = from_user_id);

-- conversations --------------------------------------------------------------
drop policy if exists "Users can view own conversations"            on public.conversations;
drop policy if exists "Authenticated users can create conversations" on public.conversations;
drop policy if exists "Participants can update conversation"        on public.conversations;

create policy "Users can view own conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) = any (participant_ids));
create policy "Authenticated users can create conversations"
  on public.conversations for insert to authenticated
  with check ((select auth.uid()) = any (participant_ids));
create policy "Participants can update conversation"
  on public.conversations for update to authenticated
  using ((select auth.uid()) = any (participant_ids))
  with check ((select auth.uid()) = any (participant_ids));

-- messages -------------------------------------------------------------------
drop policy if exists "Users can view messages in their conversations" on public.messages;
drop policy if exists "Users can send messages"                        on public.messages;
drop policy if exists "Participants can update messages"               on public.messages;
drop policy if exists "Senders can delete own messages"                on public.messages;

create policy "Users can view messages in their conversations"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (select auth.uid()) = any (c.participant_ids)
  ));
create policy "Users can send messages"
  on public.messages for insert to authenticated
  with check ((select auth.uid()) = sender_id);
create policy "Participants can update messages"
  on public.messages for update to authenticated
  using (
    (select auth.uid()) = sender_id
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  );
create policy "Senders can delete own messages"
  on public.messages for delete to authenticated
  using ((select auth.uid()) = sender_id);

-- blocks (drop legacy verbose names; keep snake_case) ------------------------
drop policy if exists "Users can view own blocks"   on public.blocks;
drop policy if exists "Users can create blocks"     on public.blocks;
drop policy if exists "Users can delete own blocks" on public.blocks;
drop policy if exists blocks_select_own             on public.blocks;
drop policy if exists blocks_insert_self            on public.blocks;
drop policy if exists blocks_delete_self            on public.blocks;

create policy blocks_select_own
  on public.blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);
create policy blocks_insert_self
  on public.blocks for insert to authenticated
  with check ((select auth.uid()) = blocker_id);
create policy blocks_delete_self
  on public.blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

-- reports (drop legacy verbose names; keep snake_case) -----------------------
drop policy if exists "Users can insert reports"   on public.reports;
drop policy if exists "Users can view own reports" on public.reports;
drop policy if exists reports_select_reporter      on public.reports;
drop policy if exists reports_insert_self          on public.reports;

create policy reports_select_reporter
  on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id);
create policy reports_insert_self
  on public.reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

-- profile_views --------------------------------------------------------------
drop policy if exists "Users can insert profile views" on public.profile_views;
drop policy if exists "Users can view who viewed them" on public.profile_views;

create policy "Users can insert profile views"
  on public.profile_views for insert to authenticated
  with check ((select auth.uid()) = viewer_id);
create policy "Users can view who viewed them"
  on public.profile_views for select to authenticated
  using ((select auth.uid()) = viewed_id or (select auth.uid()) = viewer_id);

-- subscriptions --------------------------------------------------------------
drop policy if exists "Users can view own subscription" on public.subscriptions;

create policy "Users can view own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

-- favourites (combine SELECT into one to remove the multiple-permissive lint)
drop policy if exists "Users can manage own favourites"     on public.favourites;
drop policy if exists "Users can see who favourited them"   on public.favourites;
drop policy if exists favourites_select                     on public.favourites;
drop policy if exists favourites_insert                     on public.favourites;
drop policy if exists favourites_update                     on public.favourites;
drop policy if exists favourites_delete                     on public.favourites;

create policy favourites_select
  on public.favourites for select to authenticated
  using ((select auth.uid()) = user_id or (select auth.uid()) = favourited_id);
create policy favourites_insert
  on public.favourites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy favourites_update
  on public.favourites for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy favourites_delete
  on public.favourites for delete to authenticated
  using ((select auth.uid()) = user_id);

-- conversation_hidden --------------------------------------------------------
drop policy if exists "Participants can hide conversations for self" on public.conversation_hidden;
drop policy if exists "Users can read own conversation hides"        on public.conversation_hidden;
drop policy if exists "Users can update own conversation hides"      on public.conversation_hidden;
drop policy if exists "Users can delete own conversation hides"      on public.conversation_hidden;

create policy "Users can read own conversation hides"
  on public.conversation_hidden for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Participants can hide conversations for self"
  on public.conversation_hidden for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_hidden.conversation_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  );
create policy "Users can update own conversation hides"
  on public.conversation_hidden for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own conversation hides"
  on public.conversation_hidden for delete to authenticated
  using ((select auth.uid()) = user_id);

-- message_hidden -------------------------------------------------------------
drop policy if exists "Participants can hide messages for self" on public.message_hidden;
drop policy if exists "Users can read own message hides"        on public.message_hidden;
drop policy if exists "Users can delete own message hides"      on public.message_hidden;

create policy "Users can read own message hides"
  on public.message_hidden for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Participants can hide messages for self"
  on public.message_hidden for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_hidden.message_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  );
create policy "Users can delete own message hides"
  on public.message_hidden for delete to authenticated
  using ((select auth.uid()) = user_id);

-- message_reactions ----------------------------------------------------------
drop policy if exists "Participants can view message reactions" on public.message_reactions;
drop policy if exists "Participants can react to messages"      on public.message_reactions;
drop policy if exists "Users can remove own reactions"          on public.message_reactions;

create policy "Participants can view message reactions"
  on public.message_reactions for select to authenticated
  using (exists (
    select 1
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_reactions.message_id
      and (select auth.uid()) = any (c.participant_ids)
  ));
create policy "Participants can react to messages"
  on public.message_reactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_reactions.message_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  );
create policy "Users can remove own reactions"
  on public.message_reactions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- user_settings --------------------------------------------------------------
drop policy if exists "Users can view own settings"   on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;

create policy "Users can view own settings"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own settings"
  on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update own settings"
  on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- profile_share_events -------------------------------------------------------
drop policy if exists "Users insert own share events" on public.profile_share_events;
drop policy if exists "Users read own share events"   on public.profile_share_events;

create policy "Users insert own share events"
  on public.profile_share_events for insert to authenticated
  with check ((select auth.uid()) = sharer_id);
create policy "Users read own share events"
  on public.profile_share_events for select to authenticated
  using ((select auth.uid()) = sharer_id);

-- notification_events --------------------------------------------------------
drop policy if exists notification_events_own_select on public.notification_events;

create policy notification_events_own_select
  on public.notification_events for select to authenticated
  using (recipient_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 7. Add covering indexes for unindexed foreign keys
-- ----------------------------------------------------------------------------

create index if not exists favourites_favourited_id_idx
  on public.favourites (favourited_id);
create index if not exists message_reactions_user_id_idx
  on public.message_reactions (user_id);
create index if not exists notification_events_sender_id_idx
  on public.notification_events (sender_id);
create index if not exists profile_share_events_shared_profile_id_idx
  on public.profile_share_events (shared_profile_id);
create index if not exists profile_views_viewed_id_idx
  on public.profile_views (viewed_id);
create index if not exists reports_reporter_id_idx
  on public.reports (reporter_id);
