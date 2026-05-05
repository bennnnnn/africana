-- ─────────────────────────────────────────────────────────────────────────────
-- Soft-delete (delete for me only) support on messages
--
-- A hard DELETE already handles "delete for everyone" (realtime propagates it).
-- "Delete for me" appends the requesting user's id to the deleted_for array;
-- that message is then excluded from all subsequent fetches for that user while
-- remaining visible to the other participant.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add the column
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_for uuid[] NOT NULL DEFAULT '{}';

-- 2. GIN index so the @> / = ANY() check on deleted_for is fast
CREATE INDEX IF NOT EXISTS idx_messages_deleted_for
  ON public.messages USING GIN (deleted_for);

-- 3. SECURITY DEFINER RPC so the client can atomically append its own id
--    without needing a broad UPDATE policy on the messages table.
CREATE OR REPLACE FUNCTION public.soft_delete_message_for_self(
  p_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_conv_id uuid;
BEGIN
  -- Resolve conversation to verify the caller is a participant
  SELECT conversation_id INTO v_conv_id
  FROM messages
  WHERE id = p_message_id;

  IF v_conv_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Ensure the caller is actually in this conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = v_conv_id
      AND v_user_id = ANY(participant_ids)
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  -- Idempotent: only append if not already present
  UPDATE messages
  SET deleted_for = array_append(deleted_for, v_user_id)
  WHERE id = p_message_id
    AND NOT (v_user_id = ANY(deleted_for));
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.soft_delete_message_for_self(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_message_for_self(uuid) TO authenticated;
