-- Composite index for the Discover query hot path:
--   WHERE show_in_discover = true AND avatar_url IS NOT NULL ORDER BY last_seen DESC
-- Also covers the online_only filter variant: AND online_status = 'online' AND last_seen >= ...
CREATE INDEX IF NOT EXISTS idx_profiles_discover_listing
  ON profiles (show_in_discover, last_seen DESC)
  INCLUDE (avatar_url, online_status, birthdate, gender, country, state, city, religion, verified, full_name, profile_photos, languages, online_visible);

-- Chat: speed up message fetch for a conversation excluding soft-deleted rows
-- Used by the messages read-path: WHERE conversation_id = ? AND NOT hidden_by @> ARRAY[?]
-- `hidden_by` is a jsonb column, so a GIN index supports containment operators.
CREATE INDEX IF NOT EXISTS idx_messages_conversation_hidden
  ON messages USING GIN (conversation_id uuid_ops, hidden_by);

-- Speed up RLS sub-selects and joins on likes for mutual-match checks
CREATE INDEX IF NOT EXISTS idx_likes_bidirectional
  ON likes (from_user_id, to_user_id);
