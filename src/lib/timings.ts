/** Central timing constants (see docs/improve.md). */
export const TIMINGS = {
  presenceHeartbeatMs: 60_000,
  /** Inbox fallback poll removed — kept for documentation / future reconnect backoff. */
  inboxPollFallbackMs: 60_000,
  onlineRefreshMs: 30_000,
  typingTtlMs: 3_000,
  realtimeRefreshDebounceMs: 120,
  activityCountDebounceMs: 240,
  /** Activity feed reload debounce on realtime INSERT bursts. */
  activityFeedReloadDebounceMs: 1_500,
  likesHubReloadDebounceMs: 200,
  likesHubCountDebounceMs: 280,
} as const;
