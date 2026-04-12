-- Symmetric messaging pause: if sender has receive_messages = false, block outgoing inserts too.

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
