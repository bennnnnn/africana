import type { Gender, InterestedIn } from '@/types';

/** Default interested-in for a gender (opposite of how dating apps pair). */
export function oppositeInterestedIn(gender: Gender): InterestedIn {
  if (gender === 'male') return 'women';
  return 'men';
}

/** True when the user has chosen a valid discover preference. */
export function isInterestedInProvided(
  interested: InterestedIn | string | null | undefined,
): boolean {
  return interested === 'men' || interested === 'women';
}

/** Map DB value to `men` | `women`. Coerces legacy `everyone` / null from gender. */
export function normalizeInterestedInFromDb(
  gender: Gender | null | undefined,
  raw: string | null | undefined,
): InterestedIn {
  if (raw === 'men' || raw === 'women') return raw;
  if (raw === 'everyone') {
    if (gender === 'male') return 'women';
    if (gender === 'female') return 'men';
    return 'men';
  }
  if (gender === 'male' || gender === 'female') return oppositeInterestedIn(gender);
  return 'men';
}

/** Check whether a gender/interested-in pair is internally consistent. */
export function isInterestedInAlignedWithGender(
  gender: Gender | null | undefined,
  interested: InterestedIn | string | null | undefined,
): boolean {
  if (!gender || !isInterestedInProvided(interested as InterestedIn)) return false;
  return interested === oppositeInterestedIn(gender);
}
