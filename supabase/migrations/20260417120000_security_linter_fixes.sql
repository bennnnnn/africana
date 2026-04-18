-- Fixes for Supabase security linter warnings:
--   1. function_search_path_mutable on handle_new_user + handle_updated_at
--   2. public_bucket_allows_listing on avatars + profile-photos
--
-- Leaked-password protection (warning 3) is a dashboard-only toggle and is
-- handled in the Supabase Auth settings page — not SQL-controllable.

-- ── 1. Pin search_path on trigger functions ──────────────────────────────
-- Mutable search_path is a privilege-escalation vector for SECURITY DEFINER
-- functions. Pinning it to `public, pg_temp` removes the risk without
-- changing behaviour (these functions only touch public schema anyway).
alter function public.handle_new_user()    set search_path = public, pg_temp;
alter function public.handle_updated_at()  set search_path = public, pg_temp;

-- ── 2. Drop broad SELECT policies on public buckets ──────────────────────
-- Public buckets serve object URLs via a short-circuit that does NOT consult
-- storage.objects RLS, so these broad SELECT policies only enable *listing*
-- the bucket contents — which we don't want. Removing them closes the
-- enumeration hole while leaving direct URL access (getPublicUrl) working.

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Public can view profile photos"       on storage.objects;

-- Keep per-user write/update/delete policies untouched; this migration only
-- removes the broad SELECT. If you ever need authenticated users to *list*
-- their own folder, add a narrow policy scoped to
--   (storage.foldername(name))[1] = auth.uid()::text
-- instead of a bucket-wide SELECT.

-- ── 3. notification_events: RLS on but no policies ───────────────────────
-- Writes come from Edge Functions using the service_role key (bypasses RLS),
-- so we only need a client-facing SELECT policy. Users may read their own
-- events (recipient_id = auth.uid()); everything else stays implicitly
-- denied by RLS.

alter table public.notification_events enable row level security;

-- Clean up any prior attempts at this policy (idempotent).
drop policy if exists "notification_events_client_deny_all" on public.notification_events;
drop policy if exists "notification_events_own_select"      on public.notification_events;

create policy "notification_events_own_select"
  on public.notification_events
  for select
  to authenticated
  using (recipient_id = auth.uid());

-- Supporting index so "my notifications" queries are cheap even at scale.
create index if not exists idx_notification_events_recipient_created
  on public.notification_events (recipient_id, created_at desc);
