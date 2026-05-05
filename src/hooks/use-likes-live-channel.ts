import { useEffect, type MutableRefObject } from 'react';
import { supabase } from '@/lib/supabase';
import type { LikesTab } from '@/constants/likes-screen';
import { LIKES_TAB_ORDER } from '@/constants/likes-screen';

type LoadTabFn = (t: LikesTab, force: boolean, isLoadMore?: boolean) => Promise<void>;

/**
 * When likes, profile_views, or favourites target this user, debounce-refresh
 * counts and the active tab list.
 */
export function useLikesLiveChannel(
  userId: string | undefined,
  loadTabRef: MutableRefObject<LoadTabFn>,
  fetchActivityCountsRef: MutableRefObject<() => Promise<Record<LikesTab, number> | null>>,
  tabFetchedAtRef: MutableRefObject<Record<LikesTab, number>>,
  activeTabRef: MutableRefObject<LikesTab>,
): void {
  useEffect(() => {
    if (!userId) return;

    let countDebounce: ReturnType<typeof setTimeout> | null = null;
    let reloadDebounce: ReturnType<typeof setTimeout> | null = null;

    const scheduleReloadAll = () => {
      if (countDebounce) clearTimeout(countDebounce);
      countDebounce = setTimeout(() => {
        void fetchActivityCountsRef.current();
      }, 280);
      for (const t of LIKES_TAB_ORDER) tabFetchedAtRef.current[t] = 0;
      if (reloadDebounce) clearTimeout(reloadDebounce);
      reloadDebounce = setTimeout(() => {
        void loadTabRef.current(activeTabRef.current, true);
      }, 200);
    };

    const channel = supabase
      .channel(`likes-live:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        const row = payload.new as { from_user_id?: string; to_user_id?: string };
        if (!row.from_user_id || !row.to_user_id) return;
        if (row.to_user_id === userId) {
          scheduleReloadAll();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_views' }, (payload) => {
        const row = payload.new as { viewed_id?: string };
        if (row.viewed_id !== userId) return;
        scheduleReloadAll();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favourites' }, (payload) => {
        const row = payload.new as { favourited_id?: string };
        if (row.favourited_id !== userId) return;
        scheduleReloadAll();
      })
      .subscribe();

    return () => {
      if (reloadDebounce) clearTimeout(reloadDebounce);
      if (countDebounce) clearTimeout(countDebounce);
      supabase.removeChannel(channel);
    };
  }, [userId, activeTabRef, fetchActivityCountsRef, loadTabRef, tabFetchedAtRef]);
}
