-- Track when the user last viewed each activity tab.
-- Counts shown in badge = rows newer than this timestamp → "new since last visit".
-- NULL means the user has never opened that tab (treat all rows as new).

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS likes_seen_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS views_seen_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS favourites_seen_at TIMESTAMPTZ;
