-- Supabase advisor 0028: SECURITY DEFINER RPCs must not be executable as `anon`.
-- Idempotent fix for projects that already applied 20260507100000 with PUBLIC-only revoke.
--
-- Advisor 0029 (authenticated + SECURITY DEFINER) may still warn for export_user_data /
-- mark_conversation_read; both are intentionally DEFINER-gated with auth.uid() checks
-- (same pattern as 20260426120000_revoke_anon_execute_security_definer_rpcs.sql).

revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

revoke execute on function public.export_user_data() from public, anon;
grant execute on function public.export_user_data() to authenticated;
