-- Rate limits + account-deletion RPC.
--
-- Free-tier caps (paid tier will later raise these by swapping these functions):
--   messages: 40 / rolling hour  AND  100 / rolling 24h per sender
--   likes:    40 / rolling hour  AND  100 / rolling 24h per from_user_id
--
-- Triggers raise SQLSTATE '23P01' with a distinct message that the client can
-- parse to show a friendly "slow down" toast instead of a generic error.

-- ── Messages ──────────────────────────────────────────────────────────────
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
    raise exception
      'rate_limit:messages:hour:% You''re sending messages too fast. Please wait a bit and try again.',
      max_per_hour
      using errcode = '23P01';
  end if;

  select count(*) into day_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '24 hours';

  if day_count >= max_per_day then
    raise exception
      'rate_limit:messages:day:% You''ve reached today''s message limit. Please try again tomorrow.',
      max_per_day
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_message_rate_limit on public.messages;
create trigger enforce_message_rate_limit
  before insert on public.messages
  for each row
  execute function public.enforce_message_rate_limit();

-- Supporting index for the counting queries above. Partial condition keeps it
-- small and hot — we only ever scan "recent" rows when rate-limiting.
create index if not exists idx_messages_sender_created_at
  on public.messages (sender_id, created_at desc);

-- ── Likes ─────────────────────────────────────────────────────────────────
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
    raise exception
      'rate_limit:likes:hour:% You''re liking too fast. Take a breather and try again in a bit.',
      max_per_hour
      using errcode = '23P01';
  end if;

  select count(*) into day_count
  from public.likes
  where from_user_id = new.from_user_id
    and created_at > now() - interval '24 hours';

  if day_count >= max_per_day then
    raise exception
      'rate_limit:likes:day:% You''ve reached today''s like limit. Upgrade or come back tomorrow.',
      max_per_day
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_like_rate_limit on public.likes;
create trigger enforce_like_rate_limit
  before insert on public.likes
  for each row
  execute function public.enforce_like_rate_limit();

create index if not exists idx_likes_from_user_created_at
  on public.likes (from_user_id, created_at desc);

-- ── Account deletion RPC ──────────────────────────────────────────────────
-- Called from app/(settings)/delete-account.tsx after the user re-authenticates.
-- Runs as security definer so it can reach auth.users + storage, but asserts
-- auth.uid() matches to prevent one user deleting another.
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Storage: wipe anything under the user's folder in both buckets. Using
  -- delete() on storage.objects is safe when the caller is security definer.
  delete from storage.objects
  where bucket_id in ('avatars', 'profile-photos')
    and (storage.foldername(name))[1] = uid::text;

  -- Core app data. FK cascades from profiles(id) handle conversations, messages,
  -- likes, matches, blocks, reports, views, etc. If any table lacks ON DELETE
  -- CASCADE, add an explicit delete here.
  delete from public.profiles where id = uid;

  -- Finally the auth row. This revokes sessions + refresh tokens.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_user() from public;
grant execute on function public.delete_user() to authenticated;
