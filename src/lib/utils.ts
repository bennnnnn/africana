export const ONLINE_FRESHNESS_MINUTES = 10;
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
