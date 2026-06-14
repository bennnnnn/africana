-- pgTAP: discover feed RPC uses filter params (not profile columns) for state/city.
-- Run: supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

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

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fetch_discover_profiles_page'
      and pg_get_functiondef(p.oid) like '%nullif(trim(p.avatar_url)%'
      and pg_get_functiondef(p.oid) like '%unnest(coalesce(p.profile_photos%'
  ),
  'discover RPC accepts avatar_url or first non-empty gallery photo'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fetch_discover_profiles_page'
      and pg_get_functiondef(p.oid) ilike '%p_exclude_liked boolean default false%'
      and pg_get_functiondef(p.oid) like '%l.from_user_id = p_viewer_id and l.to_user_id = p.id%'
      and pg_get_functiondef(p.oid) like '%order by%'
      and pg_get_functiondef(p.oid) like '%then 0%'
      and pg_get_functiondef(p.oid) like '%else 1%'
  ),
  'discover RPC includes liked users and sorts viewer likes first'
);

select * from finish();
rollback;
