-- Migration: make username auto-generated, disable email confirmations advice
-- Run this if you already ran the original schema

-- Make username nullable (auto-generated from email)
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN username SET DEFAULT '';

-- Add interested_in column (who the user wants to meet)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interested_in TEXT DEFAULT 'everyone';

-- ── New profile fields (added in latest update) ──────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio             TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS religion        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS education       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS marital_status  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origin_country  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origin_state    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origin_city     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS height_cm       INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_kg       INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS body_type       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ethnicity       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS occupation      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS languages       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_children    BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS want_children   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hobbies         TEXT[] DEFAULT '{}';

-- ── Gender: only male/female ──────────────────────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gender_check
  CHECK (gender IN ('male', 'female'));

-- ── Drop 'away' from online_status constraint ─────────────────────────────────
-- First drop the old check, then re-add with only online/offline
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_online_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_online_status_check
  CHECK (online_status IN ('online', 'offline'));

-- ── Ensure user_settings has a unique constraint on user_id for upsert ────────
ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_user_id_key;
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);

-- ── Subscriptions table (for future monetization) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'gold', 'platinum')),
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ,
  provider    TEXT,          -- 'revenuecat' | 'stripe' | 'manual'
  provider_id TEXT,          -- external subscription ID
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions'
      AND policyname = 'Users can view own subscription'
  ) THEN
    CREATE POLICY "Users can view own subscription"
      ON public.subscriptions FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Push token + granular notification preferences ────────────────────────────
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS push_token      TEXT    DEFAULT NULL;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notify_likes    BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notify_matches  BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notify_views    BOOLEAN DEFAULT FALSE;

-- ── Reports table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reported_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reason      TEXT NOT NULL,
  reviewed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reports'
      AND policyname = 'Users can insert reports'
  ) THEN
    CREATE POLICY "Users can insert reports"
      ON public.reports FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reports'
      AND policyname = 'Users can view own reports'
  ) THEN
    CREATE POLICY "Users can view own reports"
      ON public.reports FOR SELECT TO authenticated
      USING (auth.uid() = reporter_id);
  END IF;
END $$;

-- ── Profile views table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_views (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  viewer_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(viewer_id, viewed_id)
);
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_views'
      AND policyname = 'Users can insert profile views'
  ) THEN
    CREATE POLICY "Users can insert profile views"
      ON public.profile_views FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = viewer_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_views'
      AND policyname = 'Users can view who viewed them'
  ) THEN
    CREATE POLICY "Users can view who viewed them"
      ON public.profile_views FOR SELECT TO authenticated
      USING (auth.uid() = viewed_id OR auth.uid() = viewer_id);
  END IF;
END $$;

-- ── Favourites table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favourites (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  favourited_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, favourited_id)
);
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favourites'
      AND policyname = 'Users can manage own favourites'
  ) THEN
    CREATE POLICY "Users can manage own favourites"
      ON public.favourites FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── RLS: conversations UPDATE (last_message / last_message_at) ───────────────
-- The app updates conversations after every message send.  Without this policy
-- the update is silently blocked, leaving the conversation list stale.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations'
      AND policyname = 'Participants can update conversation'
  ) THEN
    CREATE POLICY "Participants can update conversation"
      ON public.conversations FOR UPDATE TO authenticated
      USING  (auth.uid() = ANY(participant_ids))
      WITH CHECK (auth.uid() = ANY(participant_ids));
  END IF;
END $$;

-- ── RLS: messages UPDATE for recipients (read receipts) ──────────────────────
-- Recipients need to mark messages as read (set read_at).  The original policy
-- only allowed the sender to update their own rows.  We drop it and recreate
-- it broader: allow update when the user is the sender OR a participant in the
-- same conversation.
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'Participants can update messages'
  ) THEN
    CREATE POLICY "Participants can update messages"
      ON public.messages FOR UPDATE TO authenticated
      USING (
        auth.uid() = sender_id
        OR EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
            AND auth.uid() = ANY(c.participant_ids)
        )
      );
  END IF;
END $$;

-- ── RLS: messages DELETE (delete for everyone) ────────────────────────────────
-- Only the sender can delete their own message.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'Senders can delete own messages'
  ) THEN
    CREATE POLICY "Senders can delete own messages"
      ON public.messages FOR DELETE TO authenticated
      USING (auth.uid() = sender_id);
  END IF;
END $$;

-- ── RLS: delete_user() function for full account deletion ────────────────────
-- Deletes the caller's auth.users row (which cascades to profiles via FK).
-- The app calls this via supabase.rpc('delete_user') so no service-role key
-- is needed client-side.
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_user() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_user() TO authenticated;

-- Disable email confirmation rate limit in Supabase dashboard:
-- Dashboard → Authentication → Settings → "Enable email confirmations" → OFF
-- This prevents the "rate limit exceeded" error during development

-- ── Realtime (required for live messages / likes / favourites in the app) ─────
-- Also in supabase/migrations/20260104120000_enable_realtime.sql for CLI deploys.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'favourites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.favourites;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profile_views'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_views;
  END IF;
END $$;

-- ── Public prefs RPC + message guard (settings work across RLS) ───────────────
-- Mirrors supabase/migrations/20260105100000_public_user_prefs_and_message_guard.sql
CREATE OR REPLACE FUNCTION public.get_public_user_prefs_batch(p_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  receive_messages boolean,
  show_online_status boolean,
  profile_visible boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    t.uid,
    COALESCE(s.receive_messages, true),
    COALESCE(s.show_online_status, true),
    COALESCE(s.profile_visible, true)
  FROM unnest(p_ids) AS t(uid)
  LEFT JOIN public.user_settings s ON s.user_id = t.uid;
$$;
REVOKE ALL ON FUNCTION public.get_public_user_prefs_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_user_prefs_batch(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_recipient_accepts_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
BEGIN
  SELECT x.pid INTO recipient
  FROM public.conversations c
  CROSS JOIN LATERAL (
    SELECT pid FROM unnest(c.participant_ids) AS pid WHERE pid <> NEW.sender_id LIMIT 1
  ) x
  WHERE c.id = NEW.conversation_id;

  IF recipient IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_settings
    WHERE user_id = recipient AND receive_messages = false
  ) THEN
    RAISE EXCEPTION 'recipient does not accept messages'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_settings
    WHERE user_id = NEW.sender_id AND receive_messages = false
  ) THEN
    RAISE EXCEPTION 'sender does not accept messages'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_enforce_receive_messages ON public.messages;
CREATE TRIGGER messages_enforce_receive_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_recipient_accepts_messages();

-- Profile privacy mirrors (readable by any authenticated user via profiles SELECT)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_in_discover boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepts_messages boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS online_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.show_in_discover IS 'Mirrors user_settings.profile_visible; maintained by triggers.';
COMMENT ON COLUMN public.profiles.accepts_messages IS 'Mirrors user_settings.receive_messages; maintained by triggers.';
COMMENT ON COLUMN public.profiles.online_visible IS 'Mirrors user_settings.show_online_status; when false, clients show user as offline to others.';

UPDATE public.profiles p
SET
  show_in_discover = COALESCE(s.profile_visible, true),
  accepts_messages = COALESCE(s.receive_messages, true),
  online_visible = COALESCE(s.show_online_status, true)
FROM public.user_settings s
WHERE s.user_id = p.id;

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
