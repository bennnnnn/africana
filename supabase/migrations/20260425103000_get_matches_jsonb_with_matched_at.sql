-- Return each match row as JSON including matched_at so the client can mark
-- "new" rows against user_settings.matches_seen_at (setof profiles could not
-- attach a second column without changing the return type).

drop function if exists public.get_matches(int, int);

create or replace function public.get_matches(p_limit int default 50, p_offset int default 0)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with my_sent as (
    select to_user_id as peer_id, created_at
    from public.likes
    where from_user_id = auth.uid()
  ),
  my_received as (
    select from_user_id as peer_id, created_at
    from public.likes
    where to_user_id = auth.uid()
  ),
  mutual as (
    select s.peer_id, greatest(s.created_at, r.created_at) as matched_at
    from my_sent s
    join my_received r using (peer_id)
  ),
  ranked as (
    select m.matched_at, p.*
    from mutual m
    join public.profiles p on p.id = m.peer_id
    order by m.matched_at desc
    limit greatest(1, least(p_limit, 200))
    offset greatest(0, p_offset)
  )
  select coalesce(
    (select jsonb_agg(to_jsonb(r)) from (select * from ranked order by matched_at desc) r),
    '[]'::jsonb
  );
$$;

grant execute on function public.get_matches(int, int) to authenticated;
