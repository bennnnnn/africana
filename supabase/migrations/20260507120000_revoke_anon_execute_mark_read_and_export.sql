-- Supabase advisor 0028: SECURITY DEFINER RPCs must not be executable as `anon`.
-- Idempotent fix for projects that already applied 20260507100000 with PUBLIC-only revoke.
--
-- Advisor 0029 (authenticated + SECURITY DEFINER) may still warn for export_user_data /
-- mark_conversation_read; both are intentionally DEFINER-gated with auth.uid() checks
-- (same pattern as 20260426120000_revoke_anon_execute_security_definer_rpcs.sql).

do $$
begin
  if exists (select 1 from pg_proc where proname = 'mark_conversation_read' and pronamespace = 'public'::regnamespace) then
    execute 'REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon';
    execute 'GRANT  EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated';
  end if;

  if exists (select 1 from pg_proc where proname = 'export_user_data' and pronamespace = 'public'::regnamespace) then
    execute 'REVOKE EXECUTE ON FUNCTION public.export_user_data() FROM PUBLIC, anon';
    execute 'GRANT  EXECUTE ON FUNCTION public.export_user_data() TO authenticated';
  end if;
end $$;
