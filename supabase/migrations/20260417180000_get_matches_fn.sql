-- Fast "mutual likes" lookup.
--
-- The old client-side approach fetched 100 received likes + 100 sent likes
-- (each joined to profiles, dragging profile_photos / birthdate / etc.) and
-- intersected them in JS — ~200 profile rows over the wire just to render
-- the top 20. This function does the intersection in the DB against an
-- index and returns only the recipient profiles.

create or replace function public.get_matches(p_limit int default 50)
returns setof public.profiles
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
  )
  select p.*
  from mutual m
  join public.profiles p on p.id = m.peer_id
  order by m.matched_at desc
  limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.get_matches(int) to authenticated;

-- Supporting indexes. Likely already exist if the likes table has been
-- queried at scale, but `create index if not exists` is idempotent.
create index if not exists idx_likes_from_to_created
  on public.likes (from_user_id, to_user_id, created_at desc);
create index if not exists idx_likes_to_from_created
  on public.likes (to_user_id, from_user_id, created_at desc);
