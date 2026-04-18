-- Track profile shares for growth rewards / analytics (sharer = who tapped Share).
CREATE TABLE IF NOT EXISTS public.profile_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'profile',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profile_share_events_sharer_created_idx
  ON public.profile_share_events (sharer_id, created_at DESC);

ALTER TABLE public.profile_share_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_share_events'
      AND policyname = 'Users insert own share events'
  ) THEN
    CREATE POLICY "Users insert own share events"
      ON public.profile_share_events FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = sharer_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_share_events'
      AND policyname = 'Users read own share events'
  ) THEN
    CREATE POLICY "Users read own share events"
      ON public.profile_share_events FOR SELECT TO authenticated
      USING (auth.uid() = sharer_id);
  END IF;
END $$;
