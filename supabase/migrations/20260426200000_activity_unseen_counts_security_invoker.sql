-- Lint 0029: activity_unseen_counts() can be SECURITY INVOKER if RLS allows the
-- underlying reads. Block checks use EXISTS on both (blocker_id = me) and
-- (blocked_id = me); extend blocks SELECT so either party can see the row.
--
-- Tradeoff: a user who was blocked can SELECT from public.blocks and learn the
-- blocker_id (they already could infer absence elsewhere). App code should still
-- avoid surfacing this as a product feature.

DROP POLICY IF EXISTS blocks_select_own ON public.blocks;
DROP POLICY IF EXISTS blocks_select_if_party ON public.blocks;

CREATE POLICY blocks_select_if_party
  ON public.blocks
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = blocker_id
    OR (SELECT auth.uid()) = blocked_id
  );

CREATE OR REPLACE FUNCTION public.activity_unseen_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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

COMMENT ON FUNCTION public.activity_unseen_counts() IS
  'Badge counts newer than *_seen_at; excludes blocked users. SECURITY INVOKER with blocks SELECT for either party.';
