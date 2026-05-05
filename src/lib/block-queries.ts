import { isBlockedRelationship } from '@/lib/social-actions';

/** PostgREST `or` filter for a symmetric block row between two users. */
export function symmetricBlockOrFilter(userA: string, userB: string): string {
  return `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`;
}

export async function hasSymmetricBlockBetween(userA: string, userB: string): Promise<boolean> {
  return isBlockedRelationship(userA, userB);
}
