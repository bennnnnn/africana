-- Add conversation_id to message_reactions so Realtime subscriptions can be filtered per conversation.
--
-- Without this, clients must subscribe table-wide to message_reactions and filter in JS,
-- which does not scale as total reactions grow.

alter table public.message_reactions
  add column if not exists conversation_id uuid;

-- Backfill from messages.
update public.message_reactions r
set conversation_id = m.conversation_id
from public.messages m
where m.id = r.message_id
  and r.conversation_id is null;

create or replace function public.set_message_reaction_conversation_id()
returns trigger
language plpgsql
security definer
as $$
begin
  select m.conversation_id into new.conversation_id
  from public.messages m
  where m.id = new.message_id;
  return new;
end;
$$;

revoke all on function public.set_message_reaction_conversation_id() from public;
grant execute on function public.set_message_reaction_conversation_id() to authenticated;

drop trigger if exists trg_set_message_reaction_conversation_id on public.message_reactions;
create trigger trg_set_message_reaction_conversation_id
  before insert or update of message_id
  on public.message_reactions
  for each row
  execute function public.set_message_reaction_conversation_id();

create index if not exists message_reactions_conversation_id_idx
  on public.message_reactions (conversation_id);

