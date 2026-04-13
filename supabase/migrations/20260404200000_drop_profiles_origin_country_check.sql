-- Onboarding stores origin_country from ALL_COUNTRIES (Africa + diaspora + any region).
-- A legacy CHECK named with typo "origion" only allowed a subset, causing:
--   new row for relation "profiles" violates check constraint "profiles_origion_country_check"

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_origion_country_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_origin_country_check;
