import type { User } from '@/types';

/** Minimum profile needed before main app (Discover). Optional fields (bio, photo, work, etc.) do not block. */
export function isProfileCompleteForDiscover(user: User | null | undefined): boolean {
  if (!user) return false;
  const nameOk = Boolean(user.full_name?.trim());
  const birthOk = Boolean(user.birthdate && String(user.birthdate).trim());
  const genderOk = user.gender === 'male' || user.gender === 'female';
  const interestedOk = Boolean(user.interested_in);
  const countryOk = Boolean(user.country?.trim());
  return nameOk && birthOk && genderOk && interestedOk && countryOk;
}

export function onboardingHrefFromSession(session: { user: { id: string; email?: string | null } }) {
  return {
    pathname: '/(auth)/onboarding' as const,
    params: { userId: session.user.id, email: session.user.email ?? '' },
  };
}
