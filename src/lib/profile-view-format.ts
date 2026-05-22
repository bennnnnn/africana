/** Relative "Seen … ago" label for profile activity row. */
export function formatShortLastSeenLabel(
  lastSeen: string | null | undefined,
  useLastActiveLabel: boolean,
): string | null {
  if (!useLastActiveLabel || !lastSeen) return null;
  const seenAt = new Date(lastSeen).getTime();
  if (Number.isNaN(seenAt)) return null;
  const diffMs = Date.now() - seenAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Seen just now';
  if (diffMin < 60) return `Seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Seen ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Seen 1 day ago';
  if (diffDay < 7) return `Seen ${diffDay} days ago`;
  return 'Seen a while ago';
}
