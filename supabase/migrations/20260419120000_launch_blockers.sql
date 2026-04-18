-- Launch-blocker safety + compliance bundle.
--
-- This migration locks down six things that App Store dating-app review and
-- GDPR/PIPEDA expect to see BEFORE v1 goes live:
--   1. `blocks` table exists with RLS (was only in src/lib/supabase-schema.sql).
--   2. `reports` table exists with RLS + an auto-shadowban when 3+ distinct
--      users report the same profile.
--   3. Server-side 18+ age gate (CHECK constraint on profiles.birthdate).
--   4. `profiles.terms_accepted_at` column so we can prove consent at signup.
--   5. `export_user_data()` RPC for GDPR Art. 20 data export.
--   6. Helpful indexes.
--
-- All DDL is idempotent so re-running on an environment that already has some
-- of these objects (from earlier schema bootstrapping) is safe.

-- ── 1. blocks ──────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks
  for select to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "blocks_insert_self" on public.blocks;
create policy "blocks_insert_self" on public.blocks
  for insert to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "blocks_delete_self" on public.blocks;
create policy "blocks_delete_self" on public.blocks
  for delete to authenticated
  using (auth.uid() = blocker_id);

create index if not exists idx_blocks_blocker on public.blocks (blocker_id);
create index if not exists idx_blocks_blocked on public.blocks (blocked_id);

-- ── 2. reports + auto-shadowban ────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (reporter_id, reported_id),
  check (reporter_id <> reported_id)
);

alter table public.reports enable row level security;

-- Reporters can read their own filings; nobody can read who reported them.
drop policy if exists "reports_select_reporter" on public.reports;
create policy "reports_select_reporter" on public.reports
  for select to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "reports_insert_self" on public.reports;
create policy "reports_insert_self" on public.reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

create index if not exists idx_reports_reported_id on public.reports (reported_id);

-- Auto-shadowban: when a profile accumulates SHADOWBAN_THRESHOLD distinct
-- reports, flip show_in_discover off. Moderators can flip it back on manually
-- after review. This is a trigger, not a cron, so the response is instant.
create or replace function public.auto_shadowban_reported_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  distinct_reporter_count int;
  shadowban_threshold constant int := 3;
begin
  select count(distinct reporter_id)
    into distinct_reporter_count
  from public.reports
  where reported_id = new.reported_id;

  if distinct_reporter_count >= shadowban_threshold then
    update public.profiles
       set show_in_discover = false
     where id = new.reported_id
       and show_in_discover is distinct from false;
  end if;

  return new;
end;
$$;

drop trigger if exists auto_shadowban_on_report on public.reports;
create trigger auto_shadowban_on_report
  after insert on public.reports
  for each row
  execute function public.auto_shadowban_reported_profile();

-- ── 3. Server-side 18+ age gate ────────────────────────────────────────────
-- Dropping first so re-runs don't error when the constraint already exists
-- with a different name or bound.
alter table public.profiles
  drop constraint if exists profiles_birthdate_adult_only;

alter table public.profiles
  add constraint profiles_birthdate_adult_only
  check (birthdate is null or birthdate <= (current_date - interval '18 years'));

-- ── 4. Terms/Privacy consent timestamp ─────────────────────────────────────
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.terms_accepted_at is
  'Timestamp when user accepted Terms of Service and Privacy Policy. '
  'Written once at onboarding. Used as audit trail for consent.';

-- ── 5. GDPR data export (Art. 20 right to portability) ─────────────────────
-- Returns a JSON blob containing everything we have on the calling user.
-- Client can write it to a file and share via the native share sheet.
create or replace function public.export_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'user_id',     uid,
    'profile',     (select row_to_json(p) from public.profiles p where p.id = uid),
    'settings',    (select row_to_json(s) from public.user_settings s where s.user_id = uid),
    'likes_sent',  coalesce(
                     (select jsonb_agg(row_to_json(l))
                        from public.likes l
                       where l.from_user_id = uid),
                     '[]'::jsonb),
    'likes_received', coalesce(
                     (select jsonb_agg(row_to_json(l))
                        from public.likes l
                       where l.to_user_id = uid),
                     '[]'::jsonb),
    'messages_sent', coalesce(
                     (select jsonb_agg(row_to_json(m))
                        from public.messages m
                       where m.sender_id = uid),
                     '[]'::jsonb),
    'blocks',      coalesce(
                     (select jsonb_agg(row_to_json(b))
                        from public.blocks b
                       where b.blocker_id = uid),
                     '[]'::jsonb),
    'reports_filed', coalesce(
                     (select jsonb_agg(row_to_json(r))
                        from public.reports r
                       where r.reporter_id = uid),
                     '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.export_user_data() from public;
grant execute on function public.export_user_data() to authenticated;

comment on function public.export_user_data() is
  'GDPR Article 20 data portability. Returns caller-scoped jsonb of all '
  'their stored data. Security definer because some tables are RLS-locked.';
