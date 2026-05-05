drop policy if exists "Senders can delete own messages" on public.messages;
drop policy if exists "Participants can delete messages" on public.messages;
drop policy if exists "Participants can delete conversations" on public.conversations;

create policy "Participants can delete conversations"
  on public.conversations for delete to authenticated
  using ((select auth.uid()) = any (participant_ids));

create policy "Participants can delete messages"
  on public.messages for delete to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
      and (select auth.uid()) = any (c.participant_ids)
    )
  );