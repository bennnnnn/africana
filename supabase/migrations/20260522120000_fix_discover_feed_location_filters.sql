-- P0: When viewer does not filter by state/city (NULL params), include all profiles.
-- Previous logic compared profile columns to NULL and hid rows with real city/state.

create or replace function public.fetch_discover_profiles_page(
  p_viewer_id uuid,
  p_gender text default null,
  p_min_age int default 18,
  p_max_age int default 100,
  p_country text default null,
  p_state text default null,
  p_city text default null,
  p_religion text default null,
  p_online_only boolean default false,
  p_verified_only boolean default false,
  p_exclude_liked boolean default true,
  p_limit int default 20,
  p_offset int default 0
)
returns setof public.profiles
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := current_date;
  v_max_birth date;
  v_min_birth date;
  v_online_cutoff timestamptz := now() - interval '15 minutes';
begin
  if v_uid is null or v_uid is distinct from p_viewer_id then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  p_limit := greatest(1, least(coalesce(p_limit, 20), 50));
  p_offset := greatest(0, coalesce(p_offset, 0));
  p_min_age := greatest(18, least(coalesce(p_min_age, 18), 100));
  p_max_age := greatest(p_min_age, least(coalesce(p_max_age, 100), 100));

  if p_max_age < 100 then
    v_max_birth := v_today - (p_max_age + 1) * interval '1 year' + interval '1 day';
  end if;
  if p_min_age > 18 then
    v_min_birth := v_today - p_min_age * interval '1 year';
  end if;

  return query
  select p.*
  from public.profiles p
  where p.id <> p_viewer_id
    and p.show_in_discover = true
    and p.avatar_url is not null
    and (p_gender is null or p.gender = p_gender)
    and (p_country is null or p.country = p_country)
    and (p_state is null or p.state = p_state)
    and (p_city is null or p.city = p_city)
    and (p_religion is null or p.religion = p_religion)
    and (not p_verified_only or p.verified = true)
    and (not p_online_only or (p.online_status = 'online' and p.last_seen >= v_online_cutoff))
    and p.birthdate is not null
    and (v_min_birth is null or p.birthdate <= v_min_birth)
    and (v_max_birth is null or p.birthdate >= v_max_birth)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = p_viewer_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = p_viewer_id)
    )
    and (
      not p_exclude_liked
      or not exists (
        select 1 from public.likes l
        where l.from_user_id = p_viewer_id and l.to_user_id = p.id
      )
    )
  order by p.last_seen desc nulls last, p.id
  limit p_limit
  offset p_offset;
end;
$$;
