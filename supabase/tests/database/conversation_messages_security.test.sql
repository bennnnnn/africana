-- pgTAP: security objects for conversations + messages read receipts.
-- Run: supabase test db  (requires Docker + local stack)
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- mark_conversation_read / export_user_data are SECURITY INVOKER (no privilege jump for callers).
select results_eq(
  $$
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'mark_conversation_read'
      and pg_get_function_identity_arguments(p.oid) = 'p_conversation_id uuid'
  $$,
  $$values (false)$$,
  'mark_conversation_read is not SECURITY DEFINER'
);

select results_eq(
  $$
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'export_user_data'
      and pg_get_function_identity_arguments(p.oid) = ''
  $$,
  $$values (false)$$,
  'export_user_data is not SECURITY DEFINER'
);

select has_function(
  'public',
  'mark_conversation_read',
  array['uuid']::name[],
  'mark_conversation_read(uuid) exists'
);

select has_function(
  'public',
  'refresh_conversation_preview',
  array['uuid']::name[],
  'refresh_conversation_preview(uuid) exists'
);

select has_trigger(
  'public',
  'conversations',
  'trg_conversations_immutable_fields',
  'conversations immutable-fields trigger exists'
);

select has_trigger(
  'public',
  'messages',
  'trg_messages_refresh_conversation_preview_ins',
  'messages → conversation preview trigger (insert) exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'Recipients can mark inbound messages read'
      and cmd = 'UPDATE'
  ),
  'messages has read-receipt UPDATE policy'
);

select * from finish();
rollback;
