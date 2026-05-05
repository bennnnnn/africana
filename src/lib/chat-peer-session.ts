import type { User } from '@/types';

/** Survives screen remounts (Strict Mode, navigation glitches) so the header never loses peer data mid-session. */
export const peerSnapshotByConversationId = new Map<string, User>();

/** Last chat route identity — module scope so remount does not look like a “new” chat and wipe state. */
let lastChatRouteKey: string | null = null;

export function getLastChatRouteKey(): string | null {
  return lastChatRouteKey;
}

export function setLastChatRouteKey(key: string | null): void {
  lastChatRouteKey = key;
}
