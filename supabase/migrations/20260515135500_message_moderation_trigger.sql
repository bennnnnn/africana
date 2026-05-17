-- Server-side content moderation trigger for messages.
-- Defense-in-depth: catches slurs / solicitation patterns that
-- may bypass the client-side moderateMessage() filter.
--
-- When triggered, the message is still inserted (to avoid UX
-- confusion) but flagged with moderation_flag = 'pending_review'
-- so an admin/sweeper can review later via the reports dashboard.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS moderation_flag text;

CREATE OR REPLACE FUNCTION trg_moderate_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  content_lower text;
BEGIN
  content_lower := lower(NEW.content);

  -- Slur patterns (same as client-side moderation.ts)
  IF content_lower ~ '\mn[i1l!][g9]+(er|a|ah|ga)s?\M' THEN
    NEW.moderation_flag := 'pending_review';
  ELSIF content_lower ~ '\mf[a@][g9]+(ot|gy|s)?\M' THEN
    NEW.moderation_flag := 'pending_review';
  ELSIF content_lower ~ '\mt[r]?ann(y|ies)\M' THEN
    NEW.moderation_flag := 'pending_review';
  ELSIF content_lower ~ '\mch[i1l!]nk(s|y)?\M' THEN
    NEW.moderation_flag := 'pending_review';
  ELSIF content_lower ~ '\mk[i1!]ke(s)?\M' THEN
    NEW.moderation_flag := 'pending_review';
  ELSIF content_lower ~ '\mretard(s|ed)?\M' THEN
    NEW.moderation_flag := 'pending_review';

  -- Solicitation patterns
  ELSIF content_lower ~ '\munder[\s-]?age\M' THEN
    NEW.moderation_flag := 'pending_review';
  ELSIF content_lower ~ '\m(?:1[2-7])\s*(?:yo|y/o|year\s*old)\M' THEN
    NEW.moderation_flag := 'pending_review';
  ELSIF content_lower ~ '\msend\s+(?:me\s+)?(?:nudes?|pics?|dick|pussy)\M' THEN
    NEW.moderation_flag := 'pending_review';
  ELSIF content_lower ~ '\msugar\s*dadd[yi]\M' THEN
    NEW.moderation_flag := 'pending_review';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moderate_message_trigger ON messages;
CREATE TRIGGER trg_moderate_message_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.moderation_flag IS NULL)
  EXECUTE FUNCTION trg_moderate_message();
