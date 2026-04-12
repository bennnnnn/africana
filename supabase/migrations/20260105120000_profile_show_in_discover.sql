-- Discover / online lists: filter at query time (reliable even if client RPC fails).
-- show_in_discover mirrors user_settings.profile_visible and is enforced on profile writes.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_in_discover boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.show_in_discover IS 'Mirrors user_settings.profile_visible; maintained by triggers.';

-- Backfill from current settings
UPDATE public.profiles p
SET show_in_discover = COALESCE(s.profile_visible, true)
FROM public.user_settings s
WHERE s.user_id = p.id;

-- When settings change, update the profile row (so Discover query filters work)
CREATE OR REPLACE FUNCTION public.sync_profile_show_in_discover()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET show_in_discover = COALESCE(NEW.profile_visible, true)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_sync_show_in_discover ON public.user_settings;
CREATE TRIGGER user_settings_sync_show_in_discover
  AFTER INSERT OR UPDATE OF profile_visible ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_show_in_discover();

-- Prevent clients from spoofing show_in_discover on profile updates
CREATE OR REPLACE FUNCTION public.enforce_profile_show_in_discover()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vis boolean;
BEGIN
  SELECT COALESCE(s.profile_visible, true) INTO vis
  FROM public.user_settings s
  WHERE s.user_id = NEW.id;
  IF FOUND THEN
    NEW.show_in_discover := vis;
  ELSE
    NEW.show_in_discover := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_show_in_discover ON public.profiles;
CREATE TRIGGER profiles_enforce_show_in_discover
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_show_in_discover();
