import type { User } from '@/types';
import { isInterestedInAlignedWithGender } from '@/lib/gender-match';

/** Minimum profile needed before main app (Discover). Optional fields (bio, photo, work, etc.) do not block. */
export function isProfileCompleteForDiscover(user: User | null | undefined): boolean {
  if (!user) return false;
  const nameOk = Boolean(user.full_name?.trim());
  const birthOk = Boolean(user.birthdate && String(user.birthdate).trim());
  const genderOk = user.gender === 'male' || user.gender === 'female';
  const interestedOk = isInterestedInAlignedWithGender(user.gender, user.interested_in);
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
  const doneCount = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const nextMissing = items.find((i) => !i.done) ?? null;
  return { percent, nextMissing, items };
}

export function onboardingHrefFromSession(session: { user: { id: string; email?: string | null } }) {
  return {
    pathname: '/(auth)/onboarding' as const,
    params: { userId: session.user.id, email: session.user.email ?? '' },
  };
}
