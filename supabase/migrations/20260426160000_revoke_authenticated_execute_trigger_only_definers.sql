-- Supabase advisor lint 0029: SECURITY DEFINER + EXECUTE for role `authenticated`.
-- For trigger-only (or auth-internal) functions, callers do not need EXECUTE on the
-- trigger function; revoking clears the warning without changing trigger behavior.
--
-- Keep EXECUTE for authenticated on RPCs the app calls directly (see 20260426120000):
--   activity_unseen_counts, delete_user, export_user_data, rate_limit_counts

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.messages_enforce_update() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.auto_shadowban_reported_profile() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_favourites_respect_blocks() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_like_rate_limit() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_likes_respect_blocks() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_message_rate_limit() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_privacy_mirror() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_show_in_discover() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_recipient_accepts_messages() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_user_prefs_batch(uuid[]) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_profile_privacy_mirror() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_show_in_discover() FROM authenticated;
