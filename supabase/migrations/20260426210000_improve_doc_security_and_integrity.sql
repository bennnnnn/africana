-- Audit hardening (see docs/improve.md): profiles visibility, message delete RLS,
-- profile_views + blocks, self-like/favourite constraints, indexes, shadowban dedup,
-- conversation_hidden uniqueness.

-- ── Drop duplicate shadowban trigger (keep trg_auto_shadowban_after_report_insert) ──
DROP TRIGGER IF EXISTS auto_shadowban_on_report ON public.reports;

-- ── Messages: only sender may hard-delete (participants use soft_delete_message_for_self) ──
DROP POLICY IF EXISTS "Participants can delete messages" ON public.messages;
CREATE POLICY "Senders can delete own messages"
  ON public.messages FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = sender_id);

-- ── Profiles: block-aware + hide-from-discover; still allow social graph edges ──
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable with visibility rules"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = profiles.id AND b.blocked_id = (SELECT auth.uid()))
           OR (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = profiles.id)
      )
      AND (
        show_in_discover = true
        OR EXISTS (
          SELECT 1 FROM public.likes l
          WHERE (l.from_user_id = (SELECT auth.uid()) AND l.to_user_id = profiles.id)
             OR (l.to_user_id = (SELECT auth.uid()) AND l.from_user_id = profiles.id)
        )
        OR EXISTS (
          SELECT 1 FROM public.favourites f
          WHERE (f.user_id = (SELECT auth.uid()) AND f.favourited_id = profiles.id)
             OR (f.favourited_id = (SELECT auth.uid()) AND f.user_id = profiles.id)
        )
        OR EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE (SELECT auth.uid()) = ANY (c.participant_ids)
            AND profiles.id = ANY (c.participant_ids)
        )
      )
    )
  );

-- ── Profile views: no new views between blocked pairs ──
CREATE OR REPLACE FUNCTION public.enforce_views_respect_blocks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = NEW.viewer_id AND b.blocked_id = NEW.viewed_id)
       OR (b.blocker_id = NEW.viewed_id AND b.blocked_id = NEW.viewer_id)
  ) THEN
    RAISE EXCEPTION 'interaction blocked between participants'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_views_enforce_blocks ON public.profile_views;
CREATE TRIGGER profile_views_enforce_blocks
  BEFORE INSERT ON public.profile_views
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_views_respect_blocks();

REVOKE ALL ON FUNCTION public.enforce_views_respect_blocks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_views_respect_blocks() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_views_respect_blocks() FROM authenticated;

-- ── Data hygiene: no self-likes / self-stars ──
DELETE FROM public.likes WHERE from_user_id = to_user_id;
DELETE FROM public.favourites WHERE user_id = favourited_id;

ALTER TABLE public.likes
  DROP CONSTRAINT IF EXISTS likes_no_self_reference;
ALTER TABLE public.likes
  ADD CONSTRAINT likes_no_self_reference CHECK (from_user_id <> to_user_id);

ALTER TABLE public.favourites
  DROP CONSTRAINT IF EXISTS favourites_no_self_reference;
ALTER TABLE public.favourites
  ADD CONSTRAINT favourites_no_self_reference CHECK (user_id <> favourited_id);

-- ── conversation_hidden: idempotent hides ──
CREATE UNIQUE INDEX IF NOT EXISTS conversation_hidden_user_conversation_key
  ON public.conversation_hidden (user_id, conversation_id);

-- ── Indexes (discover + inbox) ──
CREATE INDEX IF NOT EXISTS idx_profiles_show_last_seen
  ON public.profiles (show_in_discover, last_seen DESC)
  WHERE avatar_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_participant_ids_gin
  ON public.conversations USING GIN (participant_ids);

CREATE INDEX IF NOT EXISTS idx_messages_unread_rollups
  ON public.messages (conversation_id)
  WHERE read_at IS NULL;
