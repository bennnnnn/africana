-- pgTAP: critical RLS policies exist (review security matrix).
-- Run: supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'Senders can delete own messages' and cmd = 'DELETE'
  ),
  'messages DELETE is sender-only'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'Participants can delete messages' and cmd = 'DELETE'
  ),
  'messages DELETE is not all-participants'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Profiles viewable with visibility rules' and cmd = 'SELECT'
  ),
  'profiles SELECT uses visibility + block rules'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'blocks'
      and policyname = 'blocks_select_own' and cmd = 'SELECT'
  ),
  'blocks SELECT limited to parties'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'blocks'
      and policyname = 'blocks_insert_self' and cmd = 'INSERT'
  ),
  'blocks INSERT is blocker-only'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'likes'
      and policyname = 'Users can create likes' and cmd = 'INSERT'
  ),
  'likes INSERT exists'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports'
      and policyname = 'reports_insert_self' and cmd = 'INSERT'
  ),
  'reports INSERT is reporter-only'
);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_user_by_id'
  ),
  'delete_user_by_id RPC exists for account deletion'
);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enforce_recipient_accepts_messages'
  ),
  'message block/prefs trigger function exists'
);

select has_function(
  'public',
  'soft_delete_message_for_self',
  array['uuid']::name[],
  'soft_delete_message_for_self(uuid) exists for participant hide'
);

select ok(
  coalesce(
    (
      select not has_function_privilege('public', 'public.get_sweep_secret()', 'EXECUTE')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'get_sweep_secret'
      limit 1
    ),
    true
  ),
  'get_sweep_secret is not executable by PUBLIC when present'
);

select ok(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'messages'),
  'messages table has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'profiles'),
  'profiles table has RLS enabled'
);

select * from finish();
rollback;
