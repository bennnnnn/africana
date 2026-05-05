-- Enforce mutual block on message sends + let either party read the block row
-- (so clients can disable the composer when messaging is impossible).

-- ── blocks: either party can SELECT their row (still no cross-user enumeration) ─
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own
  on public.blocks for select to authenticated
  using (
    (select auth.uid()) = blocker_id
    or (select auth.uid()) = blocked_id
  );

-- ── messages: reject inserts when a symmetric block exists ─────────────────────
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
    raise exception 'messaging blocked between participants'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.user_settings
    where user_id = recipient and receive_messages = false
  ) then
    raise exception 'recipient does not accept messages'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.user_settings
    where user_id = new.sender_id and receive_messages = false
  ) then
    raise exception 'sender does not accept messages'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
