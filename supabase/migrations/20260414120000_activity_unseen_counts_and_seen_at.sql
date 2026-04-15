-- Industry-standard activity badges: server counts since *_seen_at, one RPC, block-aware.
-- Also extends seen markers for matches + sent tabs.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS matches_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_seen_at TIMESTAMPTZ;

-- Allow recipients to read rows where someone else favourited them (list + counts).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favourites'
      AND policyname = 'Users can see who favourited them'
  ) THEN
    CREATE POLICY "Users can see who favourited them"
      ON public.favourites FOR SELECT TO authenticated
      USING (auth.uid() = favourited_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.activity_unseen_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ls timestamptz;
  vs timestamptz;
  fs timestamptz;
  ms timestamptz;
  ss timestamptz;
  r bigint;
  v bigint;
  f bigint;
  s bigint;
  m bigint;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'received', 0, 'viewers', 0, 'favourites', 0, 'sent', 0, 'matches', 0
    );
  END IF;

  SELECT us.likes_seen_at, us.views_seen_at, us.favourites_seen_at, us.matches_seen_at, us.sent_seen_at
  INTO ls, vs, fs, ms, ss
  FROM public.user_settings us
  WHERE us.user_id = uid;

  SELECT COUNT(*)::bigint INTO r
  FROM public.likes l
  WHERE l.to_user_id = uid
    AND l.created_at > COALESCE(ls, '-infinity'::timestamptz)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = uid AND b.blocked_id = l.from_user_id)
         OR (b.blocked_id = uid AND b.blocker_id = l.from_user_id)
    );

  SELECT COUNT(*)::bigint INTO v
  FROM public.profile_views pv
  WHERE pv.viewed_id = uid
    AND pv.viewed_at > COALESCE(vs, '-infinity'::timestamptz)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = uid AND b.blocked_id = pv.viewer_id)
         OR (b.blocked_id = uid AND b.blocker_id = pv.viewer_id)
    );

  SELECT COUNT(*)::bigint INTO f
  FROM public.favourites fav
  WHERE fav.favourited_id = uid
    AND fav.created_at > COALESCE(fs, '-infinity'::timestamptz)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = uid AND b.blocked_id = fav.user_id)
         OR (b.blocked_id = uid AND b.blocker_id = fav.user_id)
    );

  SELECT COUNT(*)::bigint INTO s
  FROM public.likes l
  WHERE l.from_user_id = uid
    AND l.created_at > COALESCE(ss, '-infinity'::timestamptz)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = uid AND b.blocked_id = l.to_user_id)
         OR (b.blocked_id = uid AND b.blocker_id = l.to_user_id)
    );

  SELECT COUNT(DISTINCT r.from_user_id)::bigint INTO m
  FROM public.likes r
  INNER JOIN public.likes s
    ON s.from_user_id = uid AND s.to_user_id = r.from_user_id
  WHERE r.to_user_id = uid
    AND GREATEST(r.created_at, s.created_at) > COALESCE(ms, '-infinity'::timestamptz)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = uid AND b.blocked_id = r.from_user_id)
         OR (b.blocked_id = uid AND b.blocker_id = r.from_user_id)
    );

  RETURN jsonb_build_object(
    'received', COALESCE(r, 0),
    'viewers', COALESCE(v, 0),
    'favourites', COALESCE(f, 0),
    'sent', COALESCE(s, 0),
    'matches', COALESCE(m, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activity_unseen_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activity_unseen_counts() TO authenticated;

COMMENT ON FUNCTION public.activity_unseen_counts() IS
  'Badge counts: activity rows newer than user_settings *_seen_at for the current user; excludes blocked users.';
