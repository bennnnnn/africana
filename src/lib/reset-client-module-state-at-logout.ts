import { releaseAllTypingChannels } from '@/lib/typing-channel';
import { setActiveConversation } from '@/lib/active-chat';
import { resetProfileGalleryModuleState } from '@/lib/profile-gallery-cache';
import { clearAllChatCacheTables } from '@/lib/chat-cache';
import { clearProfileSeedCache } from '@/lib/profile-seed-cache';
import { resetAllLikesTabPagination } from '@/lib/likes-tab-pagination';
import { resetChatModuleStateAtLogout } from '@/store/chat.store';
import { useInboxTypingStore } from '@/store/inbox-typing.store';
import { resetDiscoverModuleState } from '@/store/discover.store';
import { resetPresenceModuleStateAtLogout } from '@/lib/app-presence-channel';
import { resetLifecycleEmailQueue } from '@/lib/notifications';
import { useActivityStore } from '@/store/activity.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';

/**
 * One place to tear down module-level + Zustand session data on sign-out.
 * Idempotent — safe if `onAuthStateChange` and `signOut` both trigger cleanup.
 */
export function resetClientModuleStateAtLogout(): void {
  resetPresenceModuleStateAtLogout();
  releaseAllTypingChannels();
  setActiveConversation(null);
  resetLifecycleEmailQueue();
  resetProfileGalleryModuleState();
  resetAllLikesTabPagination();
  resetChatModuleStateAtLogout();
  useInboxTypingStore.getState().clearAll();
  resetDiscoverModuleState();
  useActivityStore.getState().clearAll();
  useProfileBrowseStore.getState().clearOrderedUserIds();
  void clearProfileSeedCache().catch(() => {});
  void clearAllChatCacheTables().catch((e) => {
    console.warn('[logout] chat cache wipe failed', e);
  });
}
