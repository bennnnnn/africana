import { create } from 'zustand';
import { User, FilterOptions, InterestedIn } from '@/types';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { appDialog } from '@/lib/app-dialog';
import { maybeWarnLikeQuota } from '@/lib/rate-limit-warn';
import { track, EVENTS } from '@/lib/analytics';
import { getOnlineFreshnessCutoffISO, isUserEffectivelyOnline } from '@/lib/utils';
const interestedInToGender = (v: InterestedIn | undefined): string | null => {
  if (v === 'men') return 'male';
  if (v === 'women') return 'female';
  return null;
};

// Full Fisher-Yates shuffle (in-place)
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Location, religion, online, birthdate presence, and age — all in SQL so pagination matches the grid. */
function applyDiscoverSheetFilters(
  query: any,
  params: { filters: FilterOptions; today: Date; effMin: number; effMax: number },
) {
  const { filters, today, effMin, effMax } = params;
  if (filters.country) query = query.eq('country', filters.country);
  if (filters.state) query = query.eq('state', filters.state);
  if (filters.city) query = query.eq('city', filters.city);
  if (filters.religion) query = query.eq('religion', filters.religion);
  if (filters.online_only) {
    // Pair the column filter with a freshness cutoff on `last_seen` so the
    // "Online only" toggle doesn't surface accounts that crashed/force-quit
    // ages ago and got stuck on `online_status='online'`.
    query = query
      .eq('online_status', 'online')
      .gte('last_seen', getOnlineFreshnessCutoffISO());
  }

  query = query.not('birthdate', 'is', null);

  if (effMin > 18) {
    const d = new Date(today.getFullYear() - effMin, today.getMonth(), today.getDate());
    query = query.lte('birthdate', d.toISOString().slice(0, 10));
  }
  if (effMax < 100) {
    const d = new Date(today.getFullYear() - effMax - 1, today.getMonth(), today.getDate() + 1);
    query = query.gte('birthdate', d.toISOString().slice(0, 10));
  }
  return query;
}

interface AgePref { min: number; max: number }

interface DiscoverState {
  users: User[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  filters: FilterOptions;
  likedUserIds: Set<string>;
  /** Last failed `fetchUsers` message; cleared on successful fetch or manual clear. */
  fetchError: string | null;
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  clearFetchError: () => void;
  fetchUsers: (userId: string, interestedIn?: InterestedIn, reset?: boolean, agePref?: AgePref) => Promise<void>;
  toggleLike: (fromUserId: string, toUserId: string) => Promise<boolean>;
  fetchLikedUserIds: (userId: string) => Promise<void>;
  subscribeToOnlineStatus: () => void;
  unsubscribeFromOnlineStatus: () => void;
}

const DEFAULT_FILTERS: FilterOptions = {
  country: null,
  state: null,
  city: null,
  min_age: 18,
  max_age: 100,
  religion: null,
  online_only: false,
};

const PAGE_SIZE = 20;

const fetchLikedUserIdsPending = new Map<string, Promise<void>>();

let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let _subscribed = false;

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  users: [],
  isLoading: false,
  hasMore: true,
  page: 0,
  filters: DEFAULT_FILTERS,
  likedUserIds: new Set(),
  fetchError: null,

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      page: 0,
      users: [],
      hasMore: true,
      fetchError: null,
    }));
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS, page: 0, users: [], hasMore: true, fetchError: null });
  },

  clearFetchError: () => set({ fetchError: null }),

  fetchUsers: async (userId, interestedIn, reset = false, agePref) => {
    const { filters, page, isLoading } = get();
    if (isLoading) return;

    const currentPage = reset ? 0 : page;
    set({ isLoading: true, fetchError: null });

    try {
      const today = new Date();

      // ── Fetch blocks + liked IDs in parallel ───────────────────────────────
      const [blocksRes, likedRes] = await Promise.all([
        supabase
          .from('blocks')
          .select('blocked_id, blocker_id')
          .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
        supabase
          .from('likes')
          .select('to_user_id')
          .eq('from_user_id', userId),
      ]);

      const blockedIds: string[] = (blocksRes.data ?? []).map((b) =>
        b.blocker_id === userId ? b.blocked_id : b.blocker_id
      );
      const likedIds = new Set<string>((likedRes.data ?? []).map((l) => l.to_user_id));

      // Keep store in sync
      set({ likedUserIds: likedIds });

      // ── Build main query ───────────────────────────────────────────────────
      // Photo gate: require avatar_url so every card in Discover has at least
      // one visible photo. Empty-photo profiles stay signed in but are hidden
      // until they upload a photo from Me → Edit profile.
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', userId)
        .eq('show_in_discover', true)
        .not('avatar_url', 'is', null)
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      // Exclude blocked
      if (blockedIds.length > 0) {
        query = query.not('id', 'in', `(${blockedIds.join(',')})`);
      }
      // Exclude already-liked (primary pass — liked users are shown only as fallback)
      if (likedIds.size > 0) {
        query = query.not('id', 'in', `(${[...likedIds].join(',')})`);
      }

      // Gender filter
      const genderFilter = interestedInToGender(interestedIn);
      if (genderFilter) query = query.eq('gender', genderFilter);

      // ── Age: intersect Discover sheet range with profile dating-age preference ──
      const fMin = filters.min_age;
      const fMax = filters.max_age;
      const pMin = agePref?.min ?? 18;
      const pMax = agePref?.max ?? 100;
      const effMin = Math.max(fMin, pMin);
      const effMax = Math.min(fMax, pMax);

      if (effMin > effMax) {
        set((state) => ({
          users: reset || currentPage === 0 ? [] : state.users,
          page: currentPage === 0 ? 0 : currentPage,
          hasMore: false,
          fetchError: null,
        }));
        return;
      }

      query = applyDiscoverSheetFilters(query, { filters, today, effMin, effMax });

      query = query.order('last_seen', { ascending: false });

      const { data, error } = await query;

      if (error) {
        const msg = error.message || 'Could not load members';
        set((state) => ({
          fetchError: msg,
          hasMore: currentPage === 0 ? false : state.hasMore,
        }));
        return;
      }

      const processRaw = (rows: any[]): User[] =>
        rows.map((u) => {
          const bday = u.birthdate ? new Date(u.birthdate) : null;
          const age = bday
            ? today.getFullYear() -
              bday.getFullYear() -
              (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
            : 0;
          // Effective status pairs the column with a fresh `last_seen` so a
          // crashed/force-quit account doesn't sit at the top of the grid
          // claiming to be online for hours.
          const effectiveOnlineStatus =
            u.online_visible === false
              ? 'offline'
              : isUserEffectivelyOnline(u.online_status, u.last_seen)
                ? 'online'
                : 'offline';
          return {
            ...u,
            age,
            online_status: effectiveOnlineStatus,
            profile_photos: u.profile_photos ?? [],
            languages: u.languages ?? [],
          };
        });

      const rows = data ?? [];

      const processed = processRaw(rows);

      // Online users first, then shuffle the offline pool for variety
      const online  = processed.filter((u) => (u as any).online_status === 'online');
      const offline = processed.filter((u) => (u as any).online_status !== 'online');
      shuffleArray(offline);
      let result: User[] = [...online, ...offline];

      // ── Fallback: pad with liked users if results are sparse ─────────────
      if (currentPage === 0 && result.length < Math.ceil(PAGE_SIZE / 2) && likedIds.size > 0) {
          const likedIdsArr = [...likedIds].filter((id) => !blockedIds.includes(id));
          if (likedIdsArr.length > 0) {
            const needed = PAGE_SIZE - result.length;
            let likedQuery = supabase
              .from('profiles')
              .select('*')
              .in('id', likedIdsArr)
              .eq('show_in_discover', true)
              .not('avatar_url', 'is', null);
            if (genderFilter) likedQuery = likedQuery.eq('gender', genderFilter);
            likedQuery = applyDiscoverSheetFilters(likedQuery, { filters, today, effMin, effMax });
            likedQuery = likedQuery.order('last_seen', { ascending: false }).limit(needed);
            const { data: likedData } = await likedQuery;
            if (likedData) {
              const likedProcessed = (() => {
                const rows = likedData;
                return rows.map((u: any) => {
                  const bday = u.birthdate ? new Date(u.birthdate) : null;
                  const age = bday
                    ? today.getFullYear() -
                      bday.getFullYear() -
                      (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
                    : 0;
                  const effectiveOnlineStatus =
                    u.online_visible === false
                      ? 'offline'
                      : isUserEffectivelyOnline(u.online_status, u.last_seen)
                        ? 'online'
                        : 'offline';
                  return {
                    ...u,
                    age,
                    online_status: effectiveOnlineStatus,
                    profile_photos: u.profile_photos ?? [],
                    languages: u.languages ?? [],
                  };
                });
              })();
              const likedUsers = likedProcessed;
              shuffleArray(likedUsers);
              result = [...result, ...likedUsers];
            }
          }
        }

      set((state) => ({
        users: reset || currentPage === 0 ? result : [...state.users, ...result],
        page: currentPage + 1,
        hasMore: rows.length === PAGE_SIZE,
        fetchError: null,
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLikedUserIds: async (userId) => {
    const existing = fetchLikedUserIdsPending.get(userId);
    if (existing) {
      await existing;
      return;
    }
    const run = async () => {
      const { data } = await supabase
        .from('likes')
        .select('to_user_id')
        .eq('from_user_id', userId);
      if (data) set({ likedUserIds: new Set(data.map((l) => l.to_user_id)) });
    };
    const p = run();
    fetchLikedUserIdsPending.set(userId, p);
    try {
      await p;
    } finally {
      if (fetchLikedUserIdsPending.get(userId) === p) fetchLikedUserIdsPending.delete(userId);
    }
  },

  subscribeToOnlineStatus: () => {
    if (_subscribed) return;
    _subscribed = true;
    _realtimeChannel = supabase
      .channel('discover-profiles-online')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as { id?: string; online_status?: string; last_seen?: string };
          if (!updated?.id) return;
          set((state) => ({
            users: state.users.map((u) => {
              if (u.id !== updated.id) return u;
              const nextLastSeen = updated.last_seen ?? u.last_seen;
              const rawStatus = (updated.online_status ?? u.online_status) as any;
              // Re-apply the freshness check on every update so a heartbeat
              // that arrives moments before the peer goes offline doesn't
              // leave them stuck "online" in the local cache.
              const effective = isUserEffectivelyOnline(rawStatus, nextLastSeen)
                ? 'online'
                : 'offline';
              return { ...u, online_status: effective as any, last_seen: nextLastSeen };
            }),
          }));
        },
      )
      .subscribe();
  },

  unsubscribeFromOnlineStatus: () => {
    if (_realtimeChannel) {
      supabase.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }
    _subscribed = false;
  },

  toggleLike: async (fromUserId, toUserId) => {
    const { likedUserIds } = get();
    const isLiked = likedUserIds.has(toUserId);

    if (isLiked) {
      await supabase.from('likes').delete().eq('from_user_id', fromUserId).eq('to_user_id', toUserId);
      set((state) => {
        const s = new Set(state.likedUserIds);
        s.delete(toUserId);
        return { likedUserIds: s };
      });
      track(EVENTS.LIKE_REMOVED);
      return false;
    }

    const { error: insertError } = await supabase
      .from('likes')
      .insert({ from_user_id: fromUserId, to_user_id: toUserId });
    if (insertError) {
      const blob = `${insertError.message ?? ''} ${insertError.details ?? ''} ${insertError.hint ?? ''}`.toLowerCase();
      if (blob.includes('rate_limit:likes:hour')) {
        track(EVENTS.RATE_LIMIT_HIT, { topic: 'likes', window: 'hour' });
        appDialog({
          title: 'Slow down',
          message: 'You\u2019re liking too fast. Take a breather and try again in a bit.',
          icon: 'time-outline',
        });
      } else if (blob.includes('rate_limit:likes:day')) {
        track(EVENTS.RATE_LIMIT_HIT, { topic: 'likes', window: 'day' });
        appDialog({
          title: 'Daily like limit reached',
          message: 'You\u2019ve reached today\u2019s like limit. Come back tomorrow or upgrade for more.',
          icon: 'heart-dislike-outline',
        });
      } else {
        appDialog({
          title: 'Could not like',
          message: insertError.message ?? 'Please try again.',
          icon: 'alert-circle-outline',
        });
      }
      return false;
    }
    set((state) => {
      const s = new Set(state.likedUserIds);
      s.add(toUserId);
      return { likedUserIds: s };
    });

    const { data: senderProfile } = await supabase
      .from('profiles').select('full_name').eq('id', fromUserId).single();
    const senderName = senderProfile?.full_name ?? 'Someone';

    const { data: mutual } = await supabase
      .from('likes').select('id')
      .eq('from_user_id', toUserId).eq('to_user_id', fromUserId).maybeSingle();

    const isMatch = !!mutual;
    if (isMatch) {
      // Only notify the OTHER user — the current user is in the app and will see the MatchModal
      notifyUser({ type: 'match', recipientId: toUserId, senderId: fromUserId, senderName, extra: { userId: fromUserId } });
      track(EVENTS.MATCH_CREATED);
    } else {
      notifyUser({ type: 'like', recipientId: toUserId, senderId: fromUserId, senderName, extra: { userId: fromUserId } });
    }
    track(EVENTS.LIKE_SENT, { matched: isMatch });

    // Fire-and-forget soft warning when approaching the per-hour/day cap.
    void maybeWarnLikeQuota();

    return isMatch;
  },
}));
