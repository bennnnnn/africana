/**
 * iMessage-style 6 reaction set. MUST stay in sync with the
 * `message_reactions_emoji_check` CHECK constraint in Postgres — anything
 * outside this list will be rejected by the server.
 */
export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];
/** message_id → (user_id → emoji). One reaction per user per message (PK). */
export type ReactionsMap = Record<string, Record<string, ReactionEmoji>>;

/** Stable empty array so memoized rows are not invalidated every parent render. */
export const EMPTY_REACTION_LIST: string[] = [];
