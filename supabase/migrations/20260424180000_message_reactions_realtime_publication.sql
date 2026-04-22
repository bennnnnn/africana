-- Add message_reactions to the supabase_realtime publication so that
-- INSERT/UPDATE/DELETE events fire over Realtime postgres_changes.
--
-- Background: the chat screen registers a `postgres_changes` listener for
-- `message_reactions` on the same Realtime channel that handles `messages`.
-- If a channel registers a callback for a table that is NOT in the
-- publication, Supabase Realtime rejects the entire channel subscription —
-- which silently disabled message INSERT delivery, causing new messages to
-- only appear after the chat was re-opened (DB fetch fallback).
--
-- REPLICA IDENTITY FULL is required so DELETE events expose the row's
-- (message_id, user_id) so the client can locate and remove the reaction
-- locally without a refetch.

alter publication supabase_realtime add table public.message_reactions;
alter table public.message_reactions replica identity full;
