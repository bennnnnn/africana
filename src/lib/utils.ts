/**
 * How recent `profiles.last_seen` must be before we consider someone actually
 * online. The client heartbeats `last_seen` every 60 s while the app is
 * foregrounded (see `app/_layout.tsx`), so 3 minutes gives ~2 missed
 * heartbeats of grace before we mark the user as offline. This is what makes
 * the presence indicator self-healing — if the app force-quits, crashes,
 * loses network, or the OS kills it without the AppState→background event
 * firing, the user naturally falls off the online list within a few minutes
 * instead of being stuck "online" indefinitely.
 */
export const ONLINE_FRESHNESS_MINUTES = 3;

/**
 * Returns the ISO cutoff used by server-side queries that want to filter
 * "currently online" rows. Pair with `online_status = 'online'` for the
 * fastest path, but the freshness check is the source of truth.
 */
export function getOnlineFreshnessCutoffISO(
  freshnessMinutes = ONLINE_FRESHNESS_MINUTES,
): string {
  return new Date(Date.now() - freshnessMinutes * 60 * 1000).toISOString();
}
export const DEFAULT_MIN_AGE_PREFERENCE = 18;
export const DEFAULT_MAX_AGE_PREFERENCE = 100;

export function isMockEntityId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('mock-');
}

/**
 * Calculate age from an ISO birthdate string.
 * Returns undefined if birthdate is falsy.
 */
export function calculateAge(birthdate: string | null | undefined): number | undefined {
  if (!birthdate) return undefined;
  const today = new Date();
  const bday = new Date(birthdate);
  const age =
    today.getFullYear() -
    bday.getFullYear() -
    (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0);
  return age;
}

/**
 * Returns a human-readable "Last seen …" string for a user who is offline.
 * Returns null if last_seen is missing or unparseable (caller should fall back
 * to a generic label or hide the status line).
 */
export function formatLastSeen(lastSeen: string | null | undefined): string | null {
  if (!lastSeen) return null;
  const seenAt = new Date(lastSeen).getTime();
  if (Number.isNaN(seenAt)) return null;
  const diffMs = Date.now() - seenAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'Last seen just now';
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `Last seen ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Last seen yesterday';
  if (diffDay < 7)  return `Last seen ${diffDay} days ago`;
  return 'Last seen a while ago';
}

export function isUserEffectivelyOnline(
  onlineStatus: string | null | undefined,
  lastSeen: string | null | undefined,
  freshnessMinutes = ONLINE_FRESHNESS_MINUTES,
): boolean {
  if (onlineStatus !== 'online') return false;
  if (!lastSeen) return false;
  const seenAt = new Date(lastSeen).getTime();
  if (Number.isNaN(seenAt)) return false;
  return Date.now() - seenAt <= freshnessMinutes * 60 * 1000;
}

export function getEffectiveAgePreferenceRange(
  minAge: number | null | undefined,
  maxAge: number | null | undefined,
) {
  const normalizedMin = typeof minAge === 'number' ? minAge : null;
  const normalizedMax = typeof maxAge === 'number' ? maxAge : null;

  // Treat older implicit defaults as "not explicitly set" so the app shows
  // the current product default unless the user chose something themselves.
  const looksLikeLegacyDefault =
    normalizedMin === DEFAULT_MIN_AGE_PREFERENCE &&
    (normalizedMax === 40 || normalizedMax === 60);

  if ((normalizedMin === null && normalizedMax === null) || looksLikeLegacyDefault) {
    return {
      min: DEFAULT_MIN_AGE_PREFERENCE,
      max: DEFAULT_MAX_AGE_PREFERENCE,
      isImplicit: true,
    };
  }

  return {
    min: normalizedMin ?? DEFAULT_MIN_AGE_PREFERENCE,
    max: normalizedMax ?? DEFAULT_MAX_AGE_PREFERENCE,
    isImplicit: false,
  };
}

export function isRecentlyCreated(createdAt: string | null | undefined, withinDays = 14): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= withinDays * 24 * 60 * 60 * 1000;
}
