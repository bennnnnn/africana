-- 1:1 conversations: denormalized user_low_id / user_high_id for B-tree membership checks.

alter table public.conversations
  add column if not exists user_low_id uuid,
  add column if not exists user_high_id uuid;

update public.conversations
set
  user_low_id = least(participant_ids[1], participant_ids[2]),
  user_high_id = greatest(participant_ids[1], participant_ids[2])
where user_low_id is null
  and cardinality(participant_ids) = 2;

alter table public.conversations
  alter column user_low_id set not null,
  alter column user_high_id set not null;

create index if not exists idx_conversations_user_low_id
  on public.conversations (user_low_id);

create index if not exists idx_conversations_user_high_id
  on public.conversations (user_high_id);

create or replace function public.sync_conversation_member_ids()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.participant_ids is not null and cardinality(new.participant_ids) = 2 then
    new.user_low_id := least(new.participant_ids[1], new.participant_ids[2]);
    new.user_high_id := greatest(new.participant_ids[1], new.participant_ids[2]);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_conversations_sync_member_ids on public.conversations;
create trigger trg_conversations_sync_member_ids
  before insert or update of participant_ids on public.conversations
  for each row
  execute function public.sync_conversation_member_ids();

-- ── Conversations RLS ────────────────────────────────────────────────────────
drop policy if exists "Users can view their conversations" on public.conversations;
create policy "Users can view their conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_low_id, user_high_id));

drop policy if exists "Users can create conversations" on public.conversations;
create policy "Users can create conversations"
  on public.conversations for insert to authenticated
  with check ((select auth.uid()) in (user_low_id, user_high_id));

drop policy if exists "Users can update their conversations" on public.conversations;
create policy "Users can update their conversations"
  on public.conversations for update to authenticated
  using ((select auth.uid()) in (user_low_id, user_high_id))
  with check ((select auth.uid()) in (user_low_id, user_high_id));

drop policy if exists "Participants can delete conversations" on public.conversations;
create policy "Participants can delete conversations"
  on public.conversations for delete to authenticated
  using ((select auth.uid()) in (user_low_id, user_high_id));

-- ── Messages RLS ─────────────────────────────────────────────────────────────
drop policy if exists "Users can view messages in their conversations" on public.messages;
create policy "Users can view messages in their conversations"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.user_low_id, c.user_high_id)
    )
  );

drop policy if exists "Participants can delete messages" on public.messages;
create policy "Participants can delete messages"
  on public.messages for delete to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.user_low_id, c.user_high_id)
    )
  );

drop policy if exists "Participants can update message delivery state" on public.messages;
create policy "Participants can update message delivery state"
  on public.messages for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.user_low_id, c.user_high_id)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.user_low_id, c.user_high_id)
    )
  );

-- ── mark_conversation_read ───────────────────────────────────────────────────
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and v_user_id in (c.user_low_id, c.user_high_id)
  ) then
    raise exception 'Not a participant in this conversation';
  end if;

  update public.messages m
     set read_at = now()
   where m.conversation_id = p_conversation_id
     and m.read_at is null
     and m.sender_id is distinct from v_user_id;
end;
$$;

-- ── soft_delete_message_for_self ─────────────────────────────────────────────
create or replace function public.soft_delete_message_for_self(p_message_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select conversation_id into v_conv_id
  from public.messages
  where id = p_message_id;

  if v_conv_id is null then
    raise exception 'Message not found';
  end if;

  if not exists (
    select 1 from public.conversations
    where id = v_conv_id
      and v_user_id in (user_low_id, user_high_id)
  ) then
    raise exception 'Not a participant in this conversation';
  end if;

  update public.messages
  set deleted_for = array_append(deleted_for, v_user_id)
  where id = p_message_id
    and not (v_user_id = any(deleted_for));
end;
$$;

-- ── enforce_messages_limited_column_updates trigger body ───────────────────────
create or replace function public.enforce_messages_limited_column_updates()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  old_df uuid[] := coalesce(OLD.deleted_for, array[]::uuid[]);
  new_df uuid[] := coalesce(NEW.deleted_for, array[]::uuid[]);
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if OLD.id is distinct from NEW.id
     or OLD.conversation_id is distinct from NEW.conversation_id
     or OLD.sender_id is distinct from NEW.sender_id
     or OLD.content is distinct from NEW.content
     or OLD.created_at is distinct from NEW.created_at
  then
    raise exception 'Cannot modify core message fields';
  end if;

  if old_df is distinct from new_df then
    if not exists (
      select 1 from public.conversations c
      where c.id = NEW.conversation_id and uid in (c.user_low_id, c.user_high_id)
    ) then
      raise exception 'Not a participant in this conversation';
    end if;
    if not (old_df <@ new_df) then
      raise exception 'deleted_for may only grow';
    end if;
    if not (uid = any(new_df)) then
      raise exception 'Invalid soft-delete';
    end if;
  end if;

  if OLD.read_at is distinct from NEW.read_at then
    if NEW.sender_id = uid then
      raise exception 'Senders cannot change read receipts on their own messages';
    end if;
    if not exists (
      select 1 from public.conversations c
      where c.id = NEW.conversation_id and uid in (c.user_low_id, c.user_high_id)
    ) then
      raise exception 'Not a participant in this conversation';
    end if;
  end if;

  return NEW;
end;
$$;

-- ── Unread counts RPC: use denormalized membership ───────────────────────────
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
        and (select auth.uid()) in (c.user_low_id, c.user_high_id)
    )
  group by m.conversation_id;
$$;
