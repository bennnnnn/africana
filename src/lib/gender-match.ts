import type { Gender, InterestedIn } from '@/types';

/** Heterosexual matching: men see women, women see men. */
export function oppositeInterestedIn(gender: Gender): InterestedIn {
  return gender === 'male' ? 'women' : 'men';
}

/** True when the user has chosen a valid discover preference (men or women). */
export function isInterestedInProvided(interested: InterestedIn | string | null | undefined): boolean {
  return interested === 'men' || interested === 'women';
}

/** Map DB value to `men` | `women`. Legacy `everyone` / null coerces from gender when possible. */
export function normalizeInterestedInFromDb(
  gender: Gender | null | undefined,
  raw: string | null | undefined,
): InterestedIn {
  if (raw === 'men' || raw === 'women') return raw;
  if (gender === 'male' || gender === 'female') return oppositeInterestedIn(gender);
  return 'men';
}

/** Hetero-only check — do not use for “profile complete”; use {@link isInterestedInProvided} instead. */
export function isInterestedInAlignedWithGender(
  gender: Gender | null | undefined,
  interested: InterestedIn | string | null | undefined,
): boolean {
  if (gender !== 'male' && gender !== 'female') return false;
  if (interested !== 'men' && interested !== 'women') return false;
  return interested === oppositeInterestedIn(gender);
}
