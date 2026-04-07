import { supabase } from '@/lib/supabase';
import { isMockEntityId } from '@/lib/utils';

type EntityWithId = { id: string };

export async function fetchBlockedUserIdSet(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  return new Set(
    (data ?? []).map((row) =>
      row.blocker_id === userId ? String(row.blocked_id) : String(row.blocker_id),
    ),
  );
}

export async function fetchHiddenUserIdSet(candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();

  const { data: settingsRows } = await supabase
    .from('user_settings')
    .select('user_id, profile_visible')
    .in('user_id', candidateIds);

  return new Set(
    (settingsRows ?? [])
      .filter((row) => row.profile_visible === false)
      .map((row) => String(row.user_id)),
  );
}

export async function fetchSocialVisibilityContext(
  userId: string,
  candidateIds: string[],
): Promise<{ blockedIds: Set<string>; hiddenIds: Set<string> }> {
  const sanitizedCandidateIds = candidateIds.filter(
    (id) => id && id !== userId && !isMockEntityId(id),
  );

  const [blockedIds, hiddenIds] = await Promise.all([
    fetchBlockedUserIdSet(userId),
    fetchHiddenUserIdSet(sanitizedCandidateIds),
  ]);

  return { blockedIds, hiddenIds };
}

export function isUserVisibleToRequester(
  userId: string,
  otherUserId: string,
  blockedIds: Set<string>,
  hiddenIds: Set<string>,
): boolean {
  if (!otherUserId || otherUserId === userId) return false;
  if (isMockEntityId(otherUserId)) return false;
  if (blockedIds.has(otherUserId)) return false;
  if (hiddenIds.has(otherUserId)) return false;
  return true;
}

export async function filterVisibleUserEntities<T extends EntityWithId>(
  userId: string,
  entities: T[],
): Promise<T[]> {
  const unique = entities.filter((entity, index, arr) =>
    !!entity?.id && arr.findIndex((candidate) => candidate.id === entity.id) === index,
  );

  if (unique.length === 0) return [];

  const candidateIds = unique.map((entity) => String(entity.id));
  if (candidateIds.length === 0) return [];
  const { blockedIds, hiddenIds } = await fetchSocialVisibilityContext(userId, candidateIds);

  return unique.filter((entity) => {
    const id = String(entity.id);
    return isUserVisibleToRequester(userId, id, blockedIds, hiddenIds);
  });
}

export async function canInteractWithUser(userId: string, otherUserId: string): Promise<boolean> {
  if (!userId || !otherUserId || userId === otherUserId) return false;
  if (isMockEntityId(otherUserId)) return false;
  const { blockedIds, hiddenIds } = await fetchSocialVisibilityContext(userId, [otherUserId]);
  return isUserVisibleToRequester(userId, otherUserId, blockedIds, hiddenIds);
}
