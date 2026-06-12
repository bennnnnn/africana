-- pgTAP: free-tier daily cap enforcement (messages + likes).
-- Run: supabase test db  (requires Docker + local stack)
begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select has_function(
  'public',
  'user_has_active_pro',
  array['uuid']::name[],
  'user_has_active_pro(uuid) exists'
);

select ok(
  pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'enforce_message_rate_limit'
       and p.prorettype = 'trigger'::regtype)
  ) like '%rate_limit:messages:free%',
  'enforce_message_rate_limit raises free-tier discriminator'
);

select ok(
  pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'enforce_like_rate_limit'
       and p.prorettype = 'trigger'::regtype)
  ) like '%rate_limit:likes:free%',
  'enforce_like_rate_limit raises free-tier discriminator'
);

select ok(
  pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'rate_limit_counts'
       and pg_get_function_identity_arguments(p.oid) = '')
  ) like '%messages_free_limit%',
  'rate_limit_counts exposes free-tier message fields'
);

select * from finish();
rollback;
