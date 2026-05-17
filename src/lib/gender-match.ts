import type { Gender, InterestedIn } from '@/types';

/** Default interested-in for a gender (opposite of how dating apps pair). */
export function oppositeInterestedIn(gender: Gender): InterestedIn {
  if (gender === 'male') return 'women';
  if (gender === 'female') return 'men';
  return 'everyone';
}

/** True when the user has chosen a valid discover preference. */
export function isInterestedInProvided(
  interested: InterestedIn | string | null | undefined,
): boolean {
  return interested === 'men' || interested === 'women' || interested === 'everyone';
}

/** Map DB value to `men` | `women` | `everyone`. Coerces legacy values / null from gender. */
export function normalizeInterestedInFromDb(
  gender: Gender | null | undefined,
  raw: string | null | undefined,
): InterestedIn {
  if (raw === 'men' || raw === 'women' || raw === 'everyone') return raw;
  if (gender === 'male') return 'women';
  if (gender === 'female') return 'men';
  return 'everyone';
}

/** Check whether a gender/interested-in pair is internally consistent. */
export function isInterestedInAlignedWithGender(
  gender: Gender | null | undefined,
  interested: InterestedIn | string | null | undefined,
): boolean {
  if (!gender || !isInterestedInProvided(interested as InterestedIn)) return false;
  if (interested === 'everyone') return true;
  return interested === oppositeInterestedIn(gender);
}
