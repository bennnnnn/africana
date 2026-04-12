-- Cross-user prefs (receive_messages, show_online_status, profile_visible) for RLS-safe reads.
-- SECURITY DEFINER — only exposes these booleans, not push_token or email prefs.

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

-- Block new messages when the recipient has receive_messages = false
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_enforce_receive_messages ON public.messages;
CREATE TRIGGER messages_enforce_receive_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_recipient_accepts_messages();
