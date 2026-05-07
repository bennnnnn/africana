-- Ensure client can classify DB failures without matching English substrings.
-- We standardize on:
--   - SQLSTATE / errcode (e.g. 23P01, 23514)
--   - DETAIL as a stable machine discriminator (e.g. rate_limit:messages:hour)

-- ── Messages rate limits ────────────────────────────────────────────────────
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
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 hour';

  if hour_count >= max_per_hour then
    raise exception using
      errcode = '23P01',
      message = 'You''re sending messages too fast. Please wait a bit and try again.',
      detail  = 'rate_limit:messages:hour';
  end if;

  select count(*) into day_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '24 hours';

  if day_count >= max_per_day then
    raise exception using
      errcode = '23P01',
      message = 'You''ve reached today''s message limit. Please try again tomorrow.',
      detail  = 'rate_limit:messages:day';
  end if;

  return new;
end;
$$;

-- ── Likes rate limits ───────────────────────────────────────────────────────
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
  from public.likes
  where from_user_id = new.from_user_id
    and created_at > now() - interval '1 hour';

  if hour_count >= max_per_hour then
    raise exception using
      errcode = '23P01',
      message = 'You''re liking too fast. Take a breather and try again in a bit.',
      detail  = 'rate_limit:likes:hour';
  end if;

  select count(*) into day_count
  from public.likes
  where from_user_id = new.from_user_id
    and created_at > now() - interval '24 hours';

  if day_count >= max_per_day then
    raise exception using
      errcode = '23P01',
      message = 'You''ve reached today''s like limit. Upgrade or come back tomorrow.',
      detail  = 'rate_limit:likes:day';
  end if;

  return new;
end;
$$;

-- ── Messages: mutual block + receive_messages guards ────────────────────────
create or replace function public.enforce_recipient_accepts_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  select x.pid into recipient
  from public.conversations c
  cross join lateral (
    select pid from unnest(c.participant_ids) as pid where pid <> new.sender_id limit 1
  ) x
  where c.id = new.conversation_id;

  if recipient is null then
    return new;
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.sender_id and b.blocked_id = recipient)
       or (b.blocker_id = recipient and b.blocked_id = new.sender_id)
  ) then
    raise exception using
      errcode = '23514',
      message = 'Messaging is blocked between participants.',
      detail  = 'messaging_blocked_between_participants';
  end if;

  if exists (
    select 1 from public.user_settings
    where user_id = recipient and receive_messages = false
  ) then
    raise exception using
      errcode = '23514',
      message = 'Recipient does not accept messages.',
      detail  = 'recipient_messages_disabled';
  end if;

  if exists (
    select 1 from public.user_settings
    where user_id = new.sender_id and receive_messages = false
  ) then
    raise exception using
      errcode = '23514',
      message = 'Sender does not accept messages.',
      detail  = 'sender_messages_disabled';
  end if;

  return new;
end;
$$;

-- ── Likes / favourites: mutual block guard ──────────────────────────────────
create or replace function public.enforce_likes_respect_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.from_user_id and b.blocked_id = new.to_user_id)
       or (b.blocker_id = new.to_user_id and b.blocked_id = new.from_user_id)
  ) then
    raise exception using
      errcode = '23514',
      message = 'Interaction is blocked between participants.',
      detail  = 'interaction_blocked_between_participants';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_favourites_respect_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.user_id and b.blocked_id = new.favourited_id)
       or (b.blocker_id = new.favourited_id and b.blocked_id = new.user_id)
  ) then
    raise exception using
      errcode = '23514',
      message = 'Interaction is blocked between participants.',
      detail  = 'interaction_blocked_between_participants';
  end if;
  return new;
end;
$$;

