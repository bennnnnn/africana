-- Advisor lint 0029: prefer SECURITY INVOKER when RLS already constrains reads to
-- auth.uid()-scoped data.
--
-- Still SECURITY DEFINER (intentional):
--   * public.delete_user() — deletes storage.objects + auth.users
--   * public.activity_unseen_counts() — EXISTS on public.blocks needs rows where
--     blocked_id = auth.uid(); RLS only allows blocker_id = auth.uid() for SELECT

CREATE OR REPLACE FUNCTION public.rate_limit_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  msg_hour  int := 0;
  msg_day   int := 0;
  like_hour int := 0;
  like_day  int := 0;
  max_per_hour constant int := 40;
  max_per_day  constant int := 100;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'messages_hour_used',  0, 'messages_hour_limit',  max_per_hour,
      'messages_day_used',   0, 'messages_day_limit',   max_per_day,
      'likes_hour_used',     0, 'likes_hour_limit',     max_per_hour,
      'likes_day_used',      0, 'likes_day_limit',      max_per_day
    );
  END IF;

  SELECT count(*) INTO msg_hour
  FROM public.messages
  WHERE sender_id = uid
    AND created_at > now() - interval '1 hour';

  SELECT count(*) INTO msg_day
  FROM public.messages
  WHERE sender_id = uid
    AND created_at > now() - interval '24 hours';

  SELECT count(*) INTO like_hour
  FROM public.likes
  WHERE from_user_id = uid
    AND created_at > now() - interval '1 hour';

  SELECT count(*) INTO like_day
  FROM public.likes
  WHERE from_user_id = uid
    AND created_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'messages_hour_used',  msg_hour,  'messages_hour_limit',  max_per_hour,
    'messages_day_used',   msg_day,   'messages_day_limit',   max_per_day,
    'likes_hour_used',     like_hour, 'likes_hour_limit',     max_per_hour,
    'likes_day_used',      like_day,  'likes_day_limit',      max_per_day
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'user_id',     uid,
    'profile',     (SELECT row_to_json(p) FROM public.profiles p WHERE p.id = uid),
    'settings',    (SELECT row_to_json(s) FROM public.user_settings s WHERE s.user_id = uid),
    'likes_sent',  COALESCE(
                     (SELECT jsonb_agg(row_to_json(l))
                        FROM public.likes l
                       WHERE l.from_user_id = uid),
                     '[]'::jsonb),
    'likes_received', COALESCE(
                     (SELECT jsonb_agg(row_to_json(l))
                        FROM public.likes l
                       WHERE l.to_user_id = uid),
                     '[]'::jsonb),
    'messages_sent', COALESCE(
                     (SELECT jsonb_agg(row_to_json(m))
                        FROM public.messages m
                       WHERE m.sender_id = uid),
                     '[]'::jsonb),
    'blocks',      COALESCE(
                     (SELECT jsonb_agg(row_to_json(b))
                        FROM public.blocks b
                       WHERE b.blocker_id = uid),
                     '[]'::jsonb),
    'reports_filed', COALESCE(
                     (SELECT jsonb_agg(row_to_json(r))
                        FROM public.reports r
                       WHERE r.reporter_id = uid),
                     '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.export_user_data() IS
  'GDPR Article 20 data portability. SECURITY INVOKER: reads are limited by RLS to caller-owned rows.';
