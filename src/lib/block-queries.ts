import { isBlockedRelationship } from '@/lib/social-actions';
import { supabase } from '@/lib/supabase';

/** PostgREST `or` filter for a symmetric block row between two users. */
export function symmetricBlockOrFilter(userA: string, userB: string): string {
  return `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`;
}

export async function hasSymmetricBlockBetween(userA: string, userB: string): Promise<boolean> {
  return isBlockedRelationship(userA, userB);
}

/** Peer user ids involved in any block with `userId` (either side). */
export async function fetchSymmetricBlockedPeerIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) throw error;
  return (data ?? []).map((b) => (b.blocker_id === userId ? b.blocked_id : b.blocker_id));
}
