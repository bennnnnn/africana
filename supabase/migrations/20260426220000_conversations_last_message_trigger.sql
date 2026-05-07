-- Keep conversations.last_message / last_message_at aligned with the latest row
-- in messages (mitigates races when two clients send close together).

CREATE OR REPLACE FUNCTION public.sync_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  UPDATE public.conversations c
  SET
    last_message = NEW.content,
    last_message_at = NEW.created_at
  WHERE c.id = NEW.conversation_id
    AND (c.last_message_at IS NULL OR c.last_message_at <= NEW.created_at);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_sync_conversation_last ON public.messages;
CREATE TRIGGER trg_messages_sync_conversation_last
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_conversation_last_message();

REVOKE ALL ON FUNCTION public.sync_conversation_last_message() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_conversation_last_message() FROM anon;
REVOKE ALL ON FUNCTION public.sync_conversation_last_message() FROM authenticated;
