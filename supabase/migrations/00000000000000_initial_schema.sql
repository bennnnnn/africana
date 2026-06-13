-- Baseline: all CREATE TABLE IF NOT EXISTS statements for the Africana dating app.
-- This replaces the previous no-op placeholder so that `supabase db reset` works
-- on a fresh database without requiring a pre-existing schema.
--
-- Tables are created in dependency order so FK references are satisfied.
-- Every DDL statement is idempotent (IF NOT EXISTS / IF NOT …).

-- ===========================================================================
-- 1. profiles (core user profile — referenced by almost every other table)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accepts_messages    BOOLEAN NOT NULL DEFAULT false,
  avatar_url          TEXT,
  bio                 TEXT,
  birthdate           DATE NOT NULL,
  body_type           TEXT,
  city                TEXT,
  country             TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  education           TEXT,
  ethnicity           TEXT,
  favorite_interests  TEXT[] NOT NULL DEFAULT '{}',
  full_name           TEXT NOT NULL,
  gender              TEXT NOT NULL,
  has_children        BOOLEAN,
  height_cm           INTEGER,
  hobbies             TEXT[],
  interested_in       TEXT,
  languages           TEXT[],
  last_seen           TIMESTAMPTZ NOT NULL DEFAULT now(),
  looking_for         TEXT[] NOT NULL DEFAULT '{}',
  marital_status      TEXT,
  max_age_pref        INTEGER NOT NULL DEFAULT 80,
  min_age_pref        INTEGER NOT NULL DEFAULT 18,
  occupation          TEXT,
  online_status       TEXT NOT NULL DEFAULT 'offline',
  online_visible      BOOLEAN NOT NULL DEFAULT true,
  origin_city         TEXT,
  origin_country      TEXT,
  origin_state        TEXT,
  profile_photos      TEXT[] NOT NULL DEFAULT '{}',
  profile_title       TEXT,
  religion            TEXT,
  show_in_discover    BOOLEAN NOT NULL DEFAULT true,
  state               TEXT,
  terms_accepted_at   TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  username            TEXT,
  verification_photo  TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  verified            BOOLEAN NOT NULL DEFAULT false,
  verified_at         TIMESTAMPTZ,
  want_children       TEXT,
  weight_kg           INTEGER,

  CONSTRAINT profiles_birthdate_adult_only
    CHECK (birthdate IS NULL OR birthdate <= (CURRENT_DATE - INTERVAL '18 years'))
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profiles_online_status ON public.profiles (online_status);
CREATE INDEX IF NOT EXISTS idx_profiles_country        ON public.profiles (country);
CREATE INDEX IF NOT EXISTS idx_profiles_gender         ON public.profiles (gender);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen      ON public.profiles (last_seen DESC);

COMMENT ON COLUMN public.profiles.min_age_pref IS 'Minimum age preference for matches (set during onboarding)';
COMMENT ON COLUMN public.profiles.max_age_pref IS 'Maximum age preference for matches (set during onboarding)';
COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'Timestamp when user accepted Terms of Service and Privacy Policy. Written once at onboarding. Used as audit trail for consent.';

-- ===========================================================================
-- 2. user_settings (one-to-one with profiles)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_notifications  BOOLEAN NOT NULL DEFAULT true,
  favourites_seen_at   TIMESTAMPTZ,
  incognito            BOOLEAN NOT NULL DEFAULT false,
  likes_seen_at        TIMESTAMPTZ,
  matches_seen_at      TIMESTAMPTZ,
  moderation_locked    BOOLEAN NOT NULL DEFAULT false,
  notify_likes         BOOLEAN,
  notify_matches       BOOLEAN,
  notify_messages      BOOLEAN,
  notify_views         BOOLEAN,
  profile_visible      BOOLEAN NOT NULL DEFAULT true,
  push_token           TEXT,
  receive_messages     BOOLEAN NOT NULL DEFAULT true,
  sent_seen_at         TIMESTAMPTZ,
  show_online_status   BOOLEAN NOT NULL DEFAULT true,
  theme                TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  views_seen_at        TIMESTAMPTZ
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 3. likes
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.likes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (from_user_id, to_user_id),
  CHECK (from_user_id <> to_user_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_likes_to_user   ON public.likes (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_from_user ON public.likes (from_user_id, created_at DESC);

-- ===========================================================================
-- 4. conversations
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_ids  UUID[] NOT NULL,
  user_high_id     UUID NOT NULL,
  user_low_id      UUID NOT NULL,
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 5. messages
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at        TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  deleted_for      UUID[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_conv              ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at ON public.messages (sender_id, created_at DESC);

-- ===========================================================================
-- 6. message_reactions
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id       UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji            TEXT NOT NULL,
  conversation_id  UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 7. blocks
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks (blocked_id);

-- ===========================================================================
-- 8. profile_views
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.profile_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (viewer_id <> viewed_id)
);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON public.profile_views (viewed_id, viewed_at DESC);

-- ===========================================================================
-- 9. favourites
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.favourites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  favourited_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, favourited_id),
  CHECK (user_id <> favourited_id)
);

ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_favourites_favourited ON public.favourites (favourited_id, created_at DESC);

-- ===========================================================================
-- 10. reports
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  reviewed     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (reporter_id, reported_id),
  CHECK (reporter_id <> reported_id)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reports_reported_id ON public.reports (reported_id);

-- ===========================================================================
-- 11. subscriptions
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan         TEXT NOT NULL DEFAULT 'free',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  provider     TEXT,
  provider_id  TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 12. conversation_hidden (per-user hidden conversations)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.conversation_hidden (
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  hidden_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, conversation_id)
);

ALTER TABLE public.conversation_hidden ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 13. message_hidden (per-user hidden messages)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.message_hidden (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id   UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, message_id)
);

ALTER TABLE public.message_hidden ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 14. notification_events
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.notification_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  dedupe_key    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 15. profile_share_events
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.profile_share_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharer_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source            TEXT NOT NULL DEFAULT 'profile',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_share_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS profile_share_events_sharer_created_idx
  ON public.profile_share_events (sharer_id, created_at DESC);

-- ===========================================================================
-- 16. email_campaign_events
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.email_campaign_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_key      TEXT NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  trigger_metadata  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT email_campaign_events_user_campaign_key_key UNIQUE (user_id, campaign_key)
);

ALTER TABLE public.email_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_campaign_events_campaign_sent_idx
  ON public.email_campaign_events (campaign_key, sent_at DESC);

-- ===========================================================================
-- Realtime publications (ensures tables participate in replication)
-- ===========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
