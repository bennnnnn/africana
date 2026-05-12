-- Advisor 0029: soft_delete_message_for_self — SECURITY INVOKER + RLS (same pattern as
-- mark_conversation_read in 20260508130000). Replaces narrow "recipients only" UPDATE policy
-- with a participant-wide policy; column-level rules enforced by BEFORE UPDATE trigger.
--
-- delete_user RPC removed in 20260509200000 — use Edge Function delete-account + delete_user_by_id.

grant update (deleted_for) on public.messages to authenticated;

-- One permissive UPDATE policy: participants only; trigger below restricts columns.
drop policy if exists "Recipients can mark inbound messages read" on public.messages;
drop policy if exists "Participants can update message delivery state" on public.messages;
create policy "Participants can update message delivery state"
  on public.messages for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  );

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
      where c.id = NEW.conversation_id and uid = any (c.participant_ids)
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
      where c.id = NEW.conversation_id and uid = any (c.participant_ids)
    ) then
      raise exception 'Not a participant in this conversation';
    end if;
  end if;

  return NEW;
end;
$$;

revoke all on function public.enforce_messages_limited_column_updates() from public;
revoke execute on function public.enforce_messages_limited_column_updates() from anon, authenticated;

drop trigger if exists trg_messages_enforce_limited_column_updates on public.messages;
create trigger trg_messages_enforce_limited_column_updates
  before update on public.messages
  for each row
  execute function public.enforce_messages_limited_column_updates();

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
      and v_user_id = any (participant_ids)
  ) then
    raise exception 'Not a participant in this conversation';
  end if;

  update public.messages
  set deleted_for = array_append(deleted_for, v_user_id)
  where id = p_message_id
    and not (v_user_id = any(deleted_for));
end;
$$;

revoke execute on function public.soft_delete_message_for_self(uuid) from public, anon;
grant execute on function public.soft_delete_message_for_self(uuid) to authenticated;
