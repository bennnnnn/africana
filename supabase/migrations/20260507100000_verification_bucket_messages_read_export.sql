-- Private verification selfies bucket, mark-read RPC, tighten message/conversation
-- updates (preview refresh via SECURITY DEFINER triggers only), and expand
-- GDPR export coverage.

-- ── 1. verification-photos bucket (private) ─────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-photos',
  'verification-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
  set public              = excluded.public,
      name                = excluded.name,
      file_size_limit     = excluded.file_size_limit,
      allowed_mime_types  = excluded.allowed_mime_types;

drop policy if exists "Users can read own verification photos" on storage.objects;
create policy "Users can read own verification photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload own verification photos" on storage.objects;
create policy "Users can upload own verification photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own verification photos" on storage.objects;
create policy "Users can update own verification photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'verification-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'verification-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own verification photos" on storage.objects;
create policy "Users can delete own verification photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 2. Account deletion: wipe verification-photos folder too ────────────────
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

  delete from storage.objects
  where bucket_id in ('avatars', 'profile-photos', 'verification-photos')
    and (storage.foldername(name))[1] = uid::text;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

-- ── 3. Read receipts: SECURITY DEFINER RPC (no broad messages UPDATE) ─────
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
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

-- Lint 0028: anon must not execute SECURITY DEFINER RPCs (revoke PUBLIC + anon, not PUBLIC alone).
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ── 4. Conversation preview: recompute from messages (INSERT/DELETE/edits) ─
create or replace function public.refresh_conversation_preview(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations c
     set last_message     = lm.content,
         last_message_at  = lm.created_at
    from (
      select m.content, m.created_at
        from public.messages m
       where m.conversation_id = p_conversation_id
       order by m.created_at desc
       limit 1
    ) lm
   where c.id = p_conversation_id;

  update public.conversations c
     set last_message    = null,
         last_message_at = null
   where c.id = p_conversation_id
     and not exists (
       select 1 from public.messages m where m.conversation_id = p_conversation_id
     );
end;
$$;

revoke all on function public.refresh_conversation_preview(uuid) from public;
revoke all on function public.refresh_conversation_preview(uuid) from anon, authenticated;

create or replace function public.trg_messages_refresh_conversation_preview()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv uuid;
begin
  if tg_op = 'DELETE' then
    conv := old.conversation_id;
  else
    conv := new.conversation_id;
  end if;

  perform public.refresh_conversation_preview(conv);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_messages_refresh_conversation_preview() from public;
revoke all on function public.trg_messages_refresh_conversation_preview() from anon, authenticated;

drop trigger if exists trg_messages_sync_conversation_last on public.messages;
drop function if exists public.sync_conversation_last_message();

drop trigger if exists trg_messages_refresh_conversation_preview_ins on public.messages;
create trigger trg_messages_refresh_conversation_preview_ins
  after insert on public.messages
  for each row
  execute function public.trg_messages_refresh_conversation_preview();

drop trigger if exists trg_messages_refresh_conversation_preview_del on public.messages;
create trigger trg_messages_refresh_conversation_preview_del
  after delete on public.messages
  for each row
  execute function public.trg_messages_refresh_conversation_preview();

drop trigger if exists trg_messages_refresh_conversation_preview_upd on public.messages;
create trigger trg_messages_refresh_conversation_preview_upd
  after update of content, created_at on public.messages
  for each row
  execute function public.trg_messages_refresh_conversation_preview();

-- ── 5. conversations: block mutating identity columns from the client ───────
create or replace function public.enforce_conversation_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.participant_ids is distinct from old.participant_ids
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Cannot modify immutable conversation fields';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_conversation_immutable_fields() from public;

drop trigger if exists trg_conversations_immutable_fields on public.conversations;
create trigger trg_conversations_immutable_fields
  before update on public.conversations
  for each row
  execute function public.enforce_conversation_immutable_fields();

-- ── 6. Drop client-driven UPDATE on messages / conversations ──────────────
revoke update on public.messages from authenticated;
revoke update on public.messages from anon;
revoke update on public.conversations from authenticated;
revoke update on public.conversations from anon;

drop policy if exists "Participants can update messages" on public.messages;

-- ── 7. GDPR export: include additional caller-scoped tables ─────────────────
create or replace function public.export_user_data()
returns jsonb
language plpgsql
security definer
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
