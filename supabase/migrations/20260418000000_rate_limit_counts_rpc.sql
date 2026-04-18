-- Soft rate-limit counts RPC.
--
-- Pairs with the hard-limit triggers added in
-- `20260417000000_rate_limits_and_delete_user.sql`. The trigger blocks
-- inserts at the cap; this RPC lets the client show a friendly
-- "you have N messages/likes left this hour" warning *before* the user
-- hits the wall, which reads as thoughtful UX instead of a broken feature.
--
-- Free-tier caps (keep in sync with the trigger):
--   messages: 40 / rolling hour, 100 / rolling 24h
--   likes:    40 / rolling hour, 100 / rolling 24h
--
-- Returns a single jsonb row for the calling user. Cheap — two indexed
-- count queries per table, both already backed by
-- `idx_messages_sender_created_at` and `idx_likes_from_user_created_at`.

create or replace function public.rate_limit_counts()
returns jsonb
language plpgsql
stable
security definer
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
  from public.messages
  where sender_id = uid
    and created_at > now() - interval '1 hour';

  select count(*) into msg_day
  from public.messages
  where sender_id = uid
    and created_at > now() - interval '24 hours';

  select count(*) into like_hour
  from public.likes
  where from_user_id = uid
    and created_at > now() - interval '1 hour';

  select count(*) into like_day
  from public.likes
  where from_user_id = uid
    and created_at > now() - interval '24 hours';

  return jsonb_build_object(
    'messages_hour_used',  msg_hour,  'messages_hour_limit',  max_per_hour,
    'messages_day_used',   msg_day,   'messages_day_limit',   max_per_day,
    'likes_hour_used',     like_hour, 'likes_hour_limit',     max_per_hour,
    'likes_day_used',      like_day,  'likes_day_limit',      max_per_day
  );
end;
$$;

revoke all on function public.rate_limit_counts() from public;
grant execute on function public.rate_limit_counts() to authenticated;
