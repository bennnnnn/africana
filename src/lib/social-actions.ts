import { supabase } from '@/lib/supabase';
import { logWarn } from '@/lib/logger';
import { isUuidString } from '@/lib/utils';

export function isDuplicateSocialError(message?: string | null) {
  return (
    typeof message === 'string' && (message.includes('duplicate key') || message.includes('23505'))
  );
}

/** Hide shared 1:1 threads from both users' inboxes after a block (idempotent). */
export async function hideSharedConversationsForBlock(blockerId: string, blockedId: string) {
  const userLowId = blockerId < blockedId ? blockerId : blockedId;
  const userHighId = blockerId < blockedId ? blockedId : blockerId;
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_low_id', userLowId)
    .eq('user_high_id', userHighId);

  if (error || !convs?.length) return;

  const rows = convs.flatMap((c) => [
    { user_id: blockerId, conversation_id: c.id },
    { user_id: blockedId, conversation_id: c.id },
  ]);

  await supabase.from('conversation_hidden').upsert(rows, {
    onConflict: 'user_id,conversation_id',
  });
}

export async function isBlockedRelationship(userAId: string, userBId: string) {
  if (!isUuidString(userAId) || !isUuidString(userBId)) return false;

  const { data, error } = await supabase
    .from('blocks')
    .select('id')
    .or(
      `and(blocker_id.eq.${userAId},blocked_id.eq.${userBId}),and(blocker_id.eq.${userBId},blocked_id.eq.${userAId})`,
    )
    .maybeSingle();

  if (error) throw error;
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

/**
 * One round-trip: rely on UNIQUE(reporter_id, reported_id) for idempotency.
 * Does NOT auto-block — blocking is a separate explicit user action.
 */
export async function reportUser(reporterId: string, reportedId: string, reason: string) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_id: reportedId,
    reason,
  });

  if (!error) return 'inserted' as const;
  if (isDuplicateSocialError(error.message)) return 'exists' as const;
  throw error;
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (!isUuidString(blockerId) || !isUuidString(blockedId)) {
    throw new Error('Invalid UUID in blockUser');
  }

  const { error } = await supabase.from('blocks').insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });

  if (!error) {
    await hideSharedConversationsForBlock(blockerId, blockedId);
    return 'inserted' as const;
  }
  if (isDuplicateSocialError(error.message)) {
    await hideSharedConversationsForBlock(blockerId, blockedId);
    return 'exists' as const;
  }
  throw error;
}

export async function unblockUser(blockId: string) {
  const { error } = await supabase.from('blocks').delete().eq('id', blockId);
  if (error) throw error;
}
