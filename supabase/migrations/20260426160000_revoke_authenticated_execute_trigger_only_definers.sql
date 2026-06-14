-- Supabase advisor lint 0029: SECURITY DEFINER + EXECUTE for role `authenticated`.
-- For trigger-only (or auth-internal) functions, callers do not need EXECUTE on the
-- trigger function; revoking clears the warning without changing trigger behavior.
--
-- Keep EXECUTE for authenticated on RPCs the app calls directly (see 20260426120000):
--   activity_unseen_counts, delete_user, export_user_data, rate_limit_counts

do $$
declare
  fn text;
  fn_names text[] := '{
    handle_new_user,
    messages_enforce_update,
    rls_auto_enable,
    auto_shadowban_reported_profile,
    enforce_favourites_respect_blocks,
    enforce_like_rate_limit,
    enforce_likes_respect_blocks,
    enforce_message_rate_limit,
    enforce_profile_privacy_mirror,
    enforce_profile_show_in_discover,
    enforce_recipient_accepts_messages,
    sync_profile_privacy_mirror,
    sync_profile_show_in_discover
  }';
begin
  foreach fn in array fn_names loop
    if exists (select 1 from pg_proc where proname = fn and pronamespace = 'public'::regnamespace) then
      execute format('REVOKE EXECUTE ON FUNCTION public.%I() FROM authenticated', fn);
    end if;
  end loop;

  -- get_public_user_prefs_batch takes uuid[] — must use the full signature
  if exists (select 1 from pg_proc where proname = 'get_public_user_prefs_batch' and pronamespace = 'public'::regnamespace) then
    execute 'REVOKE EXECUTE ON FUNCTION public.get_public_user_prefs_batch(uuid[]) FROM authenticated';
  end if;
end $$;
