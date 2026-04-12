-- Mirror receive_messages + show_online_status onto profiles (with show_in_discover).
-- Lets any authenticated user read messaging / online-privacy flags via public profile SELECT (RLS).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_in_discover boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.show_in_discover IS 'Mirrors user_settings.profile_visible; maintained by triggers.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepts_messages boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS online_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.accepts_messages IS 'Mirrors user_settings.receive_messages; maintained by triggers.';
COMMENT ON COLUMN public.profiles.online_visible IS 'Mirrors user_settings.show_online_status; when false, clients show user as offline to others.';

UPDATE public.profiles p
SET
  show_in_discover = COALESCE(s.profile_visible, true),
  accepts_messages = COALESCE(s.receive_messages, true),
  online_visible = COALESCE(s.show_online_status, true)
FROM public.user_settings s
WHERE s.user_id = p.id;

-- Replaces profile_visible-only sync (20260105120000)
CREATE OR REPLACE FUNCTION public.sync_profile_privacy_from_user_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    show_in_discover = COALESCE(NEW.profile_visible, true),
    accepts_messages = COALESCE(NEW.receive_messages, true),
    online_visible = COALESCE(NEW.show_online_status, true)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_sync_show_in_discover ON public.user_settings;
DROP TRIGGER IF EXISTS user_settings_sync_profile_privacy ON public.user_settings;
CREATE TRIGGER user_settings_sync_profile_privacy
  AFTER INSERT OR UPDATE OF profile_visible, receive_messages, show_online_status ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_privacy_from_user_settings();

-- Replaces show_in_discover-only enforce (20260105120000)
CREATE OR REPLACE FUNCTION public.enforce_profile_privacy_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vis boolean;
  acc boolean;
  onl boolean;
BEGIN
  SELECT
    COALESCE(s.profile_visible, true),
    COALESCE(s.receive_messages, true),
    COALESCE(s.show_online_status, true)
  INTO vis, acc, onl
  FROM public.user_settings s
  WHERE s.user_id = NEW.id;
  IF FOUND THEN
    NEW.show_in_discover := vis;
    NEW.accepts_messages := acc;
    NEW.online_visible := onl;
  ELSE
    NEW.show_in_discover := true;
    NEW.accepts_messages := true;
    NEW.online_visible := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_show_in_discover ON public.profiles;
DROP TRIGGER IF EXISTS profiles_enforce_privacy_columns ON public.profiles;
CREATE TRIGGER profiles_enforce_privacy_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_privacy_columns();

DROP FUNCTION IF EXISTS public.sync_profile_show_in_discover();
DROP FUNCTION IF EXISTS public.enforce_profile_show_in_discover();
