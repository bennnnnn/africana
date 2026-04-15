import type { Gender, InterestedIn } from '@/types';

/** Heterosexual matching: men see women, women see men. */
export function oppositeInterestedIn(gender: Gender): InterestedIn {
  return gender === 'male' ? 'women' : 'men';
}

export function isInterestedInAlignedWithGender(
  gender: Gender | null | undefined,
  interested: InterestedIn | string | null | undefined,
): boolean {
  if (gender !== 'male' && gender !== 'female') return false;
  if (interested !== 'men' && interested !== 'women') return false;
  return interested === oppositeInterestedIn(gender);
}
