-- Realtime DELETE events only carry the primary key by default, so any
-- `postgres_changes` listener that filters on `conversation_id=eq.X` never
-- matches a delete and the UI looks stale ("I deleted the message but the
-- other side still shows it") until a manual refresh.
--
-- `replica identity full` makes Postgres include the OLD row in the WAL,
-- which Supabase Realtime forwards as `payload.old` — that's the only way
-- the conversation_id filter can route the event to the right listener.
alter table public.messages replica identity full;
