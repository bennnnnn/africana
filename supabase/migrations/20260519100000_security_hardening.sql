-- Security hardening: lock vault secret helpers from API callers; restore sender-only message DELETE.

-- ── Vault helpers: not callable via PostgREST (when present) ──────────────────
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_sweep_secret'
  ) then
    execute 'revoke all on function public.get_sweep_secret() from public';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_anon_key'
  ) then
    execute 'revoke all on function public.get_anon_key() from public';
  end if;
end;
$$;

-- ── Messages: only sender may hard-delete (participants use soft_delete_message_for_self) ──
drop policy if exists "Participants can delete messages" on public.messages;
drop policy if exists "Senders can delete own messages" on public.messages;

create policy "Senders can delete own messages"
  on public.messages for delete to authenticated
  using ((select auth.uid()) = sender_id);
