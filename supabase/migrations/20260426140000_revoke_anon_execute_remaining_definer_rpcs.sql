-- Remaining lint 0028 (anon + SECURITY DEFINER) after 20260426120000:
--   public.handle_new_user(), public.messages_enforce_update(), public.rls_auto_enable()
--
-- handle_new_user: must stay executable for the auth.users trigger (runs as
-- supabase_auth_admin on Supabase hosted). Do not grant back to PUBLIC/anon.
--
-- messages_enforce_update / rls_auto_enable: assumed trigger or admin helpers;
-- tighten PostgREST (anon) exposure; adjust GRANTs if a different role invokes them.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

REVOKE EXECUTE ON FUNCTION public.messages_enforce_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messages_enforce_update() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon;
-- Admin-style helper: not for publishable clients; use service_role / dashboard SQL only.
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
