-- Add age preference columns to profiles
-- These capture the user's desired age range for matches during onboarding.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS min_age_pref INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS max_age_pref INTEGER NOT NULL DEFAULT 80;

COMMENT ON COLUMN public.profiles.min_age_pref IS 'Minimum age preference for matches (set during onboarding)';
COMMENT ON COLUMN public.profiles.max_age_pref IS 'Maximum age preference for matches (set during onboarding)';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_profiles_online_status ON public.profiles(online_status);
CREATE INDEX IF NOT EXISTS idx_profiles_country       ON public.profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_gender        ON public.profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen     ON public.profiles(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_likes_to_user          ON public.likes(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_from_user        ON public.likes(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv          ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed   ON public.profile_views(viewed_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_favourites_favourited  ON public.favourites(favourited_id, created_at DESC);

-- Enable Realtime for online status tracking
-- Run this once in your Supabase project (Dashboard → Database → Replication):
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
