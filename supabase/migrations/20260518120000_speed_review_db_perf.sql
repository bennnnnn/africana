-- Speed review: bounded rate-limit scans, slimmer discover index, grouped unread counts.

-- ── Rate limits: cap index scans at max+1 rows ───────────────────────────────
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hour_count  int;
  day_count   int;
  max_per_hour constant int := 40;
  max_per_day  constant int := 100;
begin
  if new.sender_id is null then
    return new;
  end if;

  select count(*) into hour_count
  from (
    select 1 from public.messages
    where sender_id = new.sender_id
      and created_at > now() - interval '1 hour'
    limit max_per_hour + 1
  ) s;

  if hour_count >= max_per_hour then
    raise exception using
      errcode = '23P01',
      message = 'You''re sending messages too fast. Please wait a bit and try again.',
      detail  = 'rate_limit:messages:hour';
  end if;

  select count(*) into day_count
  from (
    select 1 from public.messages
    where sender_id = new.sender_id
      and created_at > now() - interval '24 hours'
    limit max_per_day + 1
  ) s;

  if day_count >= max_per_day then
    raise exception using
      errcode = '23P01',
      message = 'You''ve reached today''s message limit. Please try again tomorrow.',
      detail  = 'rate_limit:messages:day';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_like_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hour_count  int;
  day_count   int;
  max_per_hour constant int := 40;
  max_per_day  constant int := 100;
begin
  if new.from_user_id is null then
    return new;
  end if;

  select count(*) into hour_count
  from (
    select 1 from public.likes
    where from_user_id = new.from_user_id
      and created_at > now() - interval '1 hour'
    limit max_per_hour + 1
  ) s;

  if hour_count >= max_per_hour then
    raise exception using
      errcode = '23P01',
      message = 'You''re liking too fast. Take a breather and try again in a bit.',
      detail  = 'rate_limit:likes:hour';
  end if;

  select count(*) into day_count
  from (
    select 1 from public.likes
    where from_user_id = new.from_user_id
      and created_at > now() - interval '24 hours'
    limit max_per_day + 1
  ) s;

  if day_count >= max_per_day then
    raise exception using
      errcode = '23P01',
      message = 'You''ve reached today''s like limit. Upgrade or come back tomorrow.',
      detail  = 'rate_limit:likes:day';
  end if;

  return new;
end;
$$;

create or replace function public.rate_limit_counts()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  msg_hour  int := 0;
  msg_day   int := 0;
  like_hour int := 0;
  like_day  int := 0;
  max_per_hour constant int := 40;
  max_per_day  constant int := 100;
begin
  if uid is null then
    return jsonb_build_object(
      'messages_hour_used',  0, 'messages_hour_limit',  max_per_hour,
      'messages_day_used',   0, 'messages_day_limit',   max_per_day,
      'likes_hour_used',     0, 'likes_hour_limit',     max_per_hour,
      'likes_day_used',      0, 'likes_day_limit',      max_per_day
    );
  end if;

  select count(*) into msg_hour
  from (
    select 1 from public.messages
    where sender_id = uid
      and created_at > now() - interval '1 hour'
    limit max_per_hour + 1
  ) s;

  select count(*) into msg_day
  from (
    select 1 from public.messages
    where sender_id = uid
      and created_at > now() - interval '24 hours'
    limit max_per_day + 1
  ) s;

  select count(*) into like_hour
  from (
    select 1 from public.likes
    where from_user_id = uid
      and created_at > now() - interval '1 hour'
    limit max_per_hour + 1
  ) s;

  select count(*) into like_day
  from (
    select 1 from public.likes
    where from_user_id = uid
      and created_at > now() - interval '24 hours'
    limit max_per_day + 1
  ) s;

  return jsonb_build_object(
    'messages_hour_used',  msg_hour,  'messages_hour_limit',  max_per_hour,
    'messages_day_used',   msg_day,   'messages_day_limit',   max_per_day,
    'likes_hour_used',     like_hour, 'likes_hour_limit',     max_per_hour,
    'likes_day_used',      like_day,  'likes_day_limit',      max_per_day
  );
end;
$$;

-- ── Discover covering index: drop JSONB/array bloat from INCLUDE ─────────────
drop index if exists public.idx_profiles_discover_listing;

create index if not exists idx_profiles_discover_listing
  on public.profiles (show_in_discover, last_seen desc)
  include (
    avatar_url,
    online_status,
    birthdate,
    gender,
    country,
    state,
    city,
    religion,
    verified,
    full_name,
    online_visible
  );

-- ── Inbox unread rollup (replaces per-row client fetch) ───────────────────────
create or replace function public.conversation_unread_counts(p_conversation_ids uuid[])
returns table (conversation_id uuid, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select m.conversation_id, count(*)::bigint
  from public.messages m
  where m.conversation_id = any (p_conversation_ids)
    and m.read_at is null
    and m.sender_id is distinct from (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = m.conversation_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  group by m.conversation_id;
$$;

revoke all on function public.conversation_unread_counts(uuid[]) from public;
grant execute on function public.conversation_unread_counts(uuid[]) to authenticated;
