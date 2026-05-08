/**
 * How recent `profiles.last_seen` must be before we treat DB `online_status='online'`
 * as trustworthy. Live "green dot" for other users also uses Supabase Realtime Presence
 * (`app-presence-channel`) so we do not rely on periodic `last_seen` writes.
 * This window still self-heals stale rows when the app dies without a background transition.
 */
export const ONLINE_FRESHNESS_MINUTES = 3;

/**
 * Returns the ISO cutoff used by server-side queries that want to filter
 * "currently online" rows. Pair with `online_status = 'online'` for the
 * fastest path, but the freshness check is the source of truth.
 */
export function getOnlineFreshnessCutoffISO(freshnessMinutes = ONLINE_FRESHNESS_MINUTES): string {
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
  if (diffMin < 1) return 'seen just now';
  if (diffMin < 60) return `seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `seen ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'seen yesterday';
  if (diffDay < 7) return `seen ${diffDay} days ago`;
  return 'seen a while ago';
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

type PresenceInput = {
  id?: string;
  online_visible?: boolean | null;
  online_status?: string | null;
  last_seen?: string | null;
};

/**
 * Normalizes DB presence + optional Realtime Presence peer set to `online` | `offline`.
 * When `peerOnlineUserIds` contains `user.id`, the user counts as online without a DB write.
 */
export function getEffectivePresence(
  user: PresenceInput,
  peerOnlineUserIds?: ReadonlySet<string> | null,
): 'online' | 'offline' {
  if (user.online_visible === false) return 'offline';
  if (user.id && peerOnlineUserIds?.has(user.id)) return 'online';
  return isUserEffectivelyOnline(user.online_status, user.last_seen) ? 'online' : 'offline';
}

export function getEffectiveAgePreferenceRange(
  minAge: number | null | undefined,
  maxAge: number | null | undefined,
) {
  const normalizedMin = typeof minAge === 'number' ? minAge : null;
  const normalizedMax = typeof maxAge === 'number' ? maxAge : null;

  // Treat older implicit defaults as "not explicitly set" so the app shows
  // the current product default unless the user chose something themselves.
  //
  // TODO(2026-07-01): delete once all persisted defaults are migrated off
  // (min=DEFAULT_MIN_AGE_PREFERENCE and max=40/60).
  const looksLikeLegacyDefault =
    normalizedMin === DEFAULT_MIN_AGE_PREFERENCE && (normalizedMax === 40 || normalizedMax === 60);

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

/** True when `activityAt` is newer than the tab's *_seen_at marker (server uses -infinity when null). */
export function isLikesActivityNew(
  activityAt: string,
  tabSeenAt: string | null | undefined,
  seenLoaded: boolean,
): boolean {
  if (!seenLoaded) return false;
  const a = Date.parse(activityAt);
  if (Number.isNaN(a)) return false;
  if (tabSeenAt == null || tabSeenAt === '') return true;
  const s = Date.parse(tabSeenAt);
  if (Number.isNaN(s)) return true;
  return a > s;
}

const UUID_V4ISH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Safe for Postgres `uuid` columns and route params (rejects literal `"undefined"`). */
export function isUuidString(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (!t) return false;
  const low = t.toLowerCase();
  if (low === 'undefined' || low === 'null' || low === '[object object]') return false;
  return UUID_V4ISH_RE.test(t);
}
