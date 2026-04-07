import { supabase } from '@/lib/supabase';

export function isDuplicateSocialError(message?: string | null) {
  return typeof message === 'string' &&
    (message.includes('duplicate key') || message.includes('23505'));
}

export async function isBlockedRelationship(userAId: string, userBId: string) {
  const { data } = await supabase
    .from('blocks')
    .select('id')
    .or(
      `and(blocker_id.eq.${userAId},blocked_id.eq.${userBId}),and(blocker_id.eq.${userBId},blocked_id.eq.${userAId})`,
    )
    .maybeSingle();

  return !!data;
}

export async function addFavourite(userId: string, favouritedId: string) {
  if (await isBlockedRelationship(userId, favouritedId)) {
    return 'blocked' as const;
  }

  const { error } = await supabase
    .from('favourites')
    .insert({ user_id: userId, favourited_id: favouritedId });

  if (!error) return 'inserted' as const;
  if (isDuplicateSocialError(error.message)) return 'exists' as const;
  throw error;
}

export async function removeFavourite(userId: string, favouritedId: string) {
  const { error } = await supabase
    .from('favourites')
    .delete()
    .eq('user_id', userId)
    .eq('favourited_id', favouritedId);

  if (error) throw error;
}

export async function reportUser(reporterId: string, reportedId: string, reason: string) {
  const { data: existingReport, error: existingError } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_id', reporterId)
    .eq('reported_id', reportedId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingReport) return 'exists' as const;

  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: reporterId, reported_id: reportedId, reason });

  if (!error) return 'inserted' as const;
  if (isDuplicateSocialError(error.message)) return 'exists' as const;
  throw error;
}

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (!error) return 'inserted' as const;
  if (isDuplicateSocialError(error.message)) return 'exists' as const;
  throw error;
}
