-- Advisor 0029: avoid SECURITY DEFINER for RPCs that signed-in users call when INVOKER suffices.
--
-- mark_conversation_read: column-level UPDATE(read_at) + RLS so recipients (not senders)
-- can only touch read_at on messages in their conversations.
--
-- export_user_data: all subqueries are scoped to auth.uid(); existing RLS allows each slice.

-- ── Read receipts (INVOKER-safe UPDATE path) ─────────────────────────────────
grant update (read_at) on public.messages to authenticated;

drop policy if exists "Recipients can mark inbound messages read" on public.messages;
create policy "Recipients can mark inbound messages read"
  on public.messages for update to authenticated
  using (
    (select auth.uid()) is distinct from sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  )
  with check (
    (select auth.uid()) is distinct from sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) = any (c.participant_ids)
    )
  );

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
      and v_user_id = any (c.participant_ids)
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

revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ── GDPR export (RLS-enforced, no privilege elevation) ───────────────────────
create or replace function public.export_user_data()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'user_id',     uid,
    'profile',     (select row_to_json(p) from public.profiles p where p.id = uid),
    'settings',    (select row_to_json(s) from public.user_settings s where s.user_id = uid),
    'likes_sent',  coalesce(
                     (select jsonb_agg(row_to_json(l))
                        from public.likes l
                       where l.from_user_id = uid),
                     '[]'::jsonb),
    'likes_received', coalesce(
                     (select jsonb_agg(row_to_json(l))
                        from public.likes l
                       where l.to_user_id = uid),
                     '[]'::jsonb),
    'favourites_given', coalesce(
                     (select jsonb_agg(row_to_json(f))
                        from public.favourites f
                       where f.user_id = uid),
                     '[]'::jsonb),
    'favourites_received', coalesce(
                     (select jsonb_agg(row_to_json(f))
                        from public.favourites f
                       where f.favourited_id = uid),
                     '[]'::jsonb),
    'messages_sent', coalesce(
                     (select jsonb_agg(row_to_json(m))
                        from public.messages m
                       where m.sender_id = uid),
                     '[]'::jsonb),
    'messages_received', coalesce(
                     (select jsonb_agg(row_to_json(m))
                        from public.messages m
                        join public.conversations c on c.id = m.conversation_id
                       where uid = any (c.participant_ids)
                         and m.sender_id is distinct from uid),
                     '[]'::jsonb),
    'message_reactions', coalesce(
                     (select jsonb_agg(row_to_json(r))
                        from public.message_reactions r
                       where r.user_id = uid),
                     '[]'::jsonb),
    'profile_views_as_viewer', coalesce(
                     (select jsonb_agg(row_to_json(v))
                        from public.profile_views v
                       where v.viewer_id = uid),
                     '[]'::jsonb),
    'profile_views_received', coalesce(
                     (select jsonb_agg(row_to_json(v))
                        from public.profile_views v
                       where v.viewed_id = uid),
                     '[]'::jsonb),
    'conversation_hidden', coalesce(
                     (select jsonb_agg(row_to_json(h))
                        from public.conversation_hidden h
                       where h.user_id = uid),
                     '[]'::jsonb),
    'message_hidden', coalesce(
                     (select jsonb_agg(row_to_json(h))
                        from public.message_hidden h
                       where h.user_id = uid),
                     '[]'::jsonb),
    'profile_share_events', coalesce(
                     (select jsonb_agg(row_to_json(e))
                        from public.profile_share_events e
                       where e.sharer_id = uid),
                     '[]'::jsonb),
    'subscriptions', coalesce(
                     (select jsonb_agg(row_to_json(su))
                        from public.subscriptions su
                       where su.user_id = uid),
                     '[]'::jsonb),
    'notification_events', coalesce(
                     (select jsonb_agg(row_to_json(ne))
                        from public.notification_events ne
                       where ne.recipient_id = uid),
                     '[]'::jsonb),
    'blocks',      coalesce(
                     (select jsonb_agg(row_to_json(b))
                        from public.blocks b
                       where b.blocker_id = uid),
                     '[]'::jsonb),
    'reports_filed', coalesce(
                     (select jsonb_agg(row_to_json(r))
                        from public.reports r
                       where r.reporter_id = uid),
                     '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.export_user_data() from public, anon;
grant execute on function public.export_user_data() to authenticated;

comment on function public.export_user_data() is
  'GDPR Article 20 data portability. SECURITY INVOKER: each subquery is subject to RLS.';

comment on function public.mark_conversation_read(uuid) is
  'Marks inbound messages read for the caller. SECURITY INVOKER + UPDATE(read_at) + RLS.';
