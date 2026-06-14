-- Supabase advisor lint 0028: SECURITY DEFINER + PostgREST must not be callable without a session.
-- `anon` inherits EXECUTE via GRANT ... TO PUBLIC on many functions. Revoke PUBLIC + anon, then
-- restore EXECUTE for signed-in clients only.
--
-- See also: 20260426140000_revoke_anon_execute_remaining_definer_rpcs.sql for
-- handle_new_user, messages_enforce_update, and rls_auto_enable.
--
-- Lint 0029 (authenticated + SECURITY DEFINER) may still warn for these RPCs; that is normal until
-- you refactor to SECURITY INVOKER or move calls behind Edge Functions.

do $$
declare
  fn_names text[] := '{
    activity_unseen_counts,
    auto_shadowban_reported_profile,
    delete_user,
    enforce_favourites_respect_blocks,
    enforce_like_rate_limit,
    enforce_likes_respect_blocks,
    enforce_message_rate_limit,
    enforce_profile_privacy_mirror,
    enforce_profile_show_in_discover,
    enforce_recipient_accepts_messages,
    export_user_data,
    rate_limit_counts,
    sync_profile_privacy_mirror,
    sync_profile_show_in_discover
  }';
  fn text;
begin
  foreach fn in array fn_names loop
    if exists (
      select 1 from pg_proc
      where proname = fn
        and pronamespace = 'public'::regnamespace
    ) then
      execute format('REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC, anon', fn);
      execute format('GRANT  EXECUTE ON FUNCTION public.%I() TO authenticated', fn);
    end if;
  end loop;
end $$;
