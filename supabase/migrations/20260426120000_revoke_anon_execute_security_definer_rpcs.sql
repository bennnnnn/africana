-- Supabase advisor lint 0028: SECURITY DEFINER + PostgREST must not be callable without a session.
-- `anon` inherits EXECUTE via GRANT ... TO PUBLIC on many functions. Revoke PUBLIC + anon, then
-- restore EXECUTE for signed-in clients only.
--
-- See also: 20260426140000_revoke_anon_execute_remaining_definer_rpcs.sql for
-- handle_new_user, messages_enforce_update, and rls_auto_enable.
--
-- Lint 0029 (authenticated + SECURITY DEFINER) may still warn for these RPCs; that is normal until
-- you refactor to SECURITY INVOKER or move calls behind Edge Functions.

REVOKE EXECUTE ON FUNCTION public.activity_unseen_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activity_unseen_counts() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.auto_shadowban_reported_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_shadowban_reported_profile() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_favourites_respect_blocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_favourites_respect_blocks() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_like_rate_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_like_rate_limit() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_likes_respect_blocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_likes_respect_blocks() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_message_rate_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_message_rate_limit() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_profile_privacy_mirror() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_profile_privacy_mirror() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_profile_show_in_discover() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_profile_show_in_discover() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_recipient_accepts_messages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_recipient_accepts_messages() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.export_user_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_user_data() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_user_prefs_batch(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_user_prefs_batch(uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.rate_limit_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_limit_counts() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_profile_privacy_mirror() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_profile_privacy_mirror() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_profile_show_in_discover() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_profile_show_in_discover() TO authenticated;
