import type { Href } from 'expo-router';
import type { User, Gender } from '@/types';
import { isInterestedInProvided } from '@/lib/gender-match';

const VALID_GENDERS: ReadonlySet<Gender> = new Set(['male', 'female', 'nonbinary', 'other']);

/** Minimum profile needed before main app (Discover). Optional fields (bio, photo, work, etc.) do not block. */
export function isProfileCompleteForDiscover(user: User | null | undefined): boolean {
  if (!user) return false;
  const nameOk = Boolean(user.full_name?.trim());
  const birthOk = Boolean(user.birthdate && String(user.birthdate).trim());
  const genderOk = VALID_GENDERS.has(user.gender as Gender);
  const interestedOk = isInterestedInProvided(user.interested_in);
  const countryOk = Boolean(user.country?.trim());
  return nameOk && birthOk && genderOk && interestedOk && countryOk;
}

export type ProfileStrengthItem = { key: string; label: string; done: boolean };

/**
 * Richness / match quality (photo, bio, etc.). Used for nudges on Me and when viewing others’ profiles.
 * Mirrors the checklist on the Me tab.
 */
export function getProfileStrength(user: User | null | undefined): {
  percent: number;
  nextMissing: ProfileStrengthItem | null;
  items: ProfileStrengthItem[];
} {
  if (!user) {
    return { percent: 0, nextMissing: null, items: [] };
  }
  const photos = user.profile_photos ?? [];
  const items: ProfileStrengthItem[] = [
    { key: 'photo', label: 'Profile photo', done: photos.length > 0 },
    { key: 'bio', label: 'Bio', done: !!user.bio },
    { key: 'religion', label: 'Religion', done: !!user.religion },
    { key: 'education', label: 'Education', done: !!user.education },
    { key: 'occupation', label: 'Occupation', done: !!user.occupation },
    { key: 'height', label: 'Height', done: !!user.height_cm },
    { key: 'ethnicity', label: 'Ethnicity', done: !!user.ethnicity },
    { key: 'languages', label: 'Languages', done: (user.languages ?? []).length > 0 },
    { key: 'hobbies', label: 'Hobbies', done: (user.hobbies ?? []).length > 0 },
  ];
  // Weighted scoring: photo 3x, bio 2x, everything else 1x. Total possible = 3+2+7 = 12.
  const weights = [3, 2, 1, 1, 1, 1, 1, 1, 1];
  const maxWeight = weights.reduce((a, b) => a + b, 0);
  const scoredWeight = weights.reduce((sum, w, i) => sum + (items[i].done ? w : 0), 0);
  const percent = Math.round((scoredWeight / maxWeight) * 100);

  // Next missing: prefer the highest-weight undone item first
  const nextMissing =
    items.find((i) => i.key === 'photo' && !i.done) ??
    items.find((i) => i.key === 'bio' && !i.done) ??
    items.find((i) => !i.done) ??
    null;
  return { percent, nextMissing, items };
}

export function onboardingHrefFromSession(session: {
  user: { id: string; email?: string | null };
}) {
  return {
    pathname: '/(auth)/onboarding' as const,
    params: { userId: session.user.id, email: session.user.email ?? '' },
  };
}

/** Where to send a signed-in user: main app vs onboarding (single decision point). */
export function postAuthHref(
  user: User | null | undefined,
  session: { user: { id: string; email?: string | null } },
): Href {
  if (isProfileCompleteForDiscover(user)) {
    return '/(tabs)/discover';
  }
  return onboardingHrefFromSession(session);
}

export function redirectAfterAuth(
  router: { replace: (href: Href) => void },
  user: User | null | undefined,
  session: { user: { id: string; email?: string | null } },
) {
  router.replace(postAuthHref(user, session));
}
