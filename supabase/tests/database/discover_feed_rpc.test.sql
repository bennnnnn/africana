-- pgTAP: discover feed RPC uses filter params (not profile columns) for state/city.
-- Run: supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select has_function(
  'public',
  'fetch_discover_profiles_page',
  array[
    'uuid', 'text', 'integer', 'integer', 'text', 'text', 'text', 'text',
    'boolean', 'boolean', 'boolean', 'integer', 'integer'
  ]::name[],
  'fetch_discover_profiles_page exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fetch_discover_profiles_page'
      and pg_get_functiondef(p.oid) like '%and (p_state is null or p.state = p_state)%'
      and pg_get_functiondef(p.oid) like '%and (p_city is null or p.city = p_city)%'
  ),
  'discover RPC compares filter params to profile state/city'
);

select * from finish();
rollback;
