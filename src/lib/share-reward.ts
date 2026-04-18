/**
 * Growth-phase rewards for users who share profiles (word-of-mouth).
 * When premium is on (`PAYMENTS_ENABLED`), `getSubscription` treats qualified
 * sharers as Gold until the community crosses `GROWTH_SHARE_REWARD_UNTIL_PROFILE_COUNT`.
 */
import { supabase } from './supabase';

/** Master switch — turn off when you no longer want share-based perks. */
export const GROWTH_SHARE_REWARD_ACTIVE = true;

/** While total profiles are below this, share-based Gold bonus can apply (see payments.ts). */
export const GROWTH_SHARE_REWARD_UNTIL_PROFILE_COUNT = 10_000;

export const SHARE_REWARD_TOAST =
  'Thanks for sharing Africana. Early supporters get Gold-level access while we grow!';

export async function growthShareRewardsCurrentlyApplies(): Promise<boolean> {
  if (!GROWTH_SHARE_REWARD_ACTIVE) return false;
  const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  if (error) return false;
  return (count ?? 0) < GROWTH_SHARE_REWARD_UNTIL_PROFILE_COUNT;
}

export async function userHasRecordedProfileShare(sharerId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('profile_share_events')
    .select('*', { count: 'exact', head: true })
    .eq('sharer_id', sharerId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function recordProfileShareEvent(
  sharerId: string,
  sharedProfileId: string,
  source: string = 'profile'
): Promise<{ ok: boolean; error?: string }> {
  if (!GROWTH_SHARE_REWARD_ACTIVE) return { ok: true };
  const { error } = await supabase.from('profile_share_events').insert({
    sharer_id: sharerId,
    shared_profile_id: sharedProfileId,
    source,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
