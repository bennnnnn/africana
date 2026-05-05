-- Single round-trip activity feed for the Activity tab (likes, matches, views, recent messages).

create or replace function public.get_activity_feed()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with
  like_events as (
    select
      'like-' || l.id::text as item_id,
      case
        when exists (
          select 1
          from public.likes me
          where me.from_user_id = auth.uid()
            and me.to_user_id = l.from_user_id
        ) then 'match'
        else 'like'
      end as item_type,
      l.from_user_id as user_id,
      coalesce(p.full_name, '') as name,
      coalesce(p.avatar_url, p.profile_photos[1]) as avatar_url,
      null::text as preview,
      l.created_at as created_at,
      '/(profile)/' || l.from_user_id::text as nav_target
    from public.likes l
    join public.profiles p on p.id = l.from_user_id
    where l.to_user_id = auth.uid()
    order by l.created_at desc
    limit 20
  ),
  view_events as (
    select
      'view-' || v.id::text as item_id,
      'view'::text as item_type,
      v.viewer_id as user_id,
      coalesce(p.full_name, '') as name,
      coalesce(p.avatar_url, p.profile_photos[1]) as avatar_url,
      null::text as preview,
      v.viewed_at as created_at,
      '/(profile)/' || v.viewer_id::text as nav_target
    from public.profile_views v
    join public.profiles p on p.id = v.viewer_id
    where v.viewed_id = auth.uid()
      and not exists (
        select 1
        from public.likes a
        join public.likes b
          on b.from_user_id = v.viewer_id
         and b.to_user_id = auth.uid()
        where a.from_user_id = auth.uid()
          and a.to_user_id = v.viewer_id
      )
    order by v.viewed_at desc
    limit 20
  ),
  msg_events as (
    select
      'msg-' || c.id::text as item_id,
      'message'::text as item_type,
      (array_remove(c.participant_ids, auth.uid()))[1] as user_id,
      coalesce(p.full_name, '') as name,
      coalesce(p.avatar_url, p.profile_photos[1]) as avatar_url,
      coalesce(c.last_message, '') as preview,
      coalesce(c.last_message_at, c.created_at) as created_at,
      '/(chat)/' || c.id::text as nav_target
    from public.conversations c
    join public.profiles p
      on p.id = (array_remove(c.participant_ids, auth.uid()))[1]
    where auth.uid() = any (c.participant_ids)
      and c.last_message is not null
    order by c.last_message_at desc nulls last
    limit 10
  ),
  unioned as (
    select * from like_events
    union all
    select * from view_events
    union all
    select * from msg_events
  ),
  deduped as (
    select distinct on (item_type, user_id)
      item_id,
      item_type,
      user_id,
      name,
      avatar_url,
      preview,
      created_at,
      nav_target
    from unioned
    order by item_type, user_id, created_at desc
  )
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', d.item_id,
          'type', d.item_type,
          'userId', d.user_id,
          'name', d.name,
          'avatarUrl', d.avatar_url,
          'preview', d.preview,
          'createdAt', d.created_at,
          'navTarget', d.nav_target
        )
        order by d.created_at desc
      )
      from deduped d
    ),
    '[]'::jsonb
  );
$$;

grant execute on function public.get_activity_feed() to authenticated;
