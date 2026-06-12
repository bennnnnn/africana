-- Enforce free-tier daily caps (10 messages / 10 likes per rolling 24h) server-side.
-- Pro users (active row in public.subscriptions) skip the free cap but still hit
-- the anti-spam ceiling (40/h, 100/24h). Keep max_free_* in sync with
-- FREE_DAILY_MESSAGES / FREE_DAILY_LIKES in src/lib/payments.ts.

create or replace function public.user_has_active_pro(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.is_active = true
      and s.plan = 'pro'
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

revoke all on function public.user_has_active_pro(uuid) from public;
revoke execute on function public.user_has_active_pro(uuid) from anon, authenticated;

-- ── Messages ────────────────────────────────────────────────────────────────
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hour_count  int;
  day_count   int;
  free_count  int;
  max_per_hour constant int := 40;
  max_per_day  constant int := 100;
  max_free_per_day constant int := 10;
begin
  if new.sender_id is null then
    return new;
  end if;

  if not public.user_has_active_pro(new.sender_id) then
    select count(*) into free_count
    from (
      select 1 from public.messages
      where sender_id = new.sender_id
        and created_at > now() - interval '24 hours'
      limit max_free_per_day + 1
    ) s;

    if free_count >= max_free_per_day then
      raise exception using
        errcode = '23P01',
        message = 'You''ve used your 10 free messages today.',
        detail  = 'rate_limit:messages:free';
    end if;
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

-- ── Likes ───────────────────────────────────────────────────────────────────
create or replace function public.enforce_like_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hour_count  int;
  day_count   int;
  free_count  int;
  max_per_hour constant int := 40;
  max_per_day  constant int := 100;
  max_free_per_day constant int := 10;
begin
  if new.from_user_id is null then
    return new;
  end if;

  if not public.user_has_active_pro(new.from_user_id) then
    select count(*) into free_count
    from (
      select 1 from public.likes
      where from_user_id = new.from_user_id
        and created_at > now() - interval '24 hours'
      limit max_free_per_day + 1
    ) s;

    if free_count >= max_free_per_day then
      raise exception using
        errcode = '23P01',
        message = 'You''ve used your 10 free likes today.',
        detail  = 'rate_limit:likes:free';
    end if;
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

-- ── Quota read RPC (client UI + pre-insert gate) ─────────────────────────────
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
  is_pro    boolean := false;
  max_per_hour constant int := 40;
  max_per_day  constant int := 100;
  max_free_per_day constant int := 10;
begin
  if uid is null then
    return jsonb_build_object(
      'is_pro', false,
      'messages_hour_used',  0, 'messages_hour_limit',  max_per_hour,
      'messages_day_used',   0, 'messages_day_limit',   max_per_day,
      'messages_free_used',  0, 'messages_free_limit',  max_free_per_day,
      'likes_hour_used',     0, 'likes_hour_limit',     max_per_hour,
      'likes_day_used',      0, 'likes_day_limit',      max_per_day,
      'likes_free_used',     0, 'likes_free_limit',     max_free_per_day
    );
  end if;

  is_pro := public.user_has_active_pro(uid);

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
    'is_pro', is_pro,
    'messages_hour_used',  msg_hour,  'messages_hour_limit',  max_per_hour,
    'messages_day_used',   msg_day,   'messages_day_limit',   max_per_day,
    'messages_free_used',  least(msg_day, max_free_per_day), 'messages_free_limit', max_free_per_day,
    'likes_hour_used',     like_hour, 'likes_hour_limit',     max_per_hour,
    'likes_day_used',      like_day,  'likes_day_limit',      max_per_day,
    'likes_free_used',     least(like_day, max_free_per_day), 'likes_free_limit', max_free_per_day
  );
end;
$$;
