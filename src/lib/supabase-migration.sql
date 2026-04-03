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
  ADD COLUMN IF NOT EXISTS religion        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS education       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS marital_status  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS height_cm       INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ethnicity       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS occupation      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS languages       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_children    BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS want_children   TEXT DEFAULT NULL;

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
