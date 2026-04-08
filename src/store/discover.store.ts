import { create } from 'zustand';
import { User, FilterOptions, InterestedIn } from '@/types';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { MOCK_USERS } from '@/lib/mock-data';

const interestedInToGender = (v: InterestedIn | undefined): string | null => {
  if (v === 'men')   return 'male';
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

interface AgePref { min: number; max: number }

interface DiscoverState {
  users: User[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  filters: FilterOptions;
  likedUserIds: Set<string>;
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
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

let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let _subscribed = false;

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  users: [],
  isLoading: false,
  hasMore: true,
  page: 0,
  filters: DEFAULT_FILTERS,
  likedUserIds: new Set(),

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters }, page: 0, users: [], hasMore: true }));
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS, page: 0, users: [], hasMore: true });
  },

  fetchUsers: async (userId, interestedIn, reset = false, agePref) => {
    const { filters, page, isLoading } = get();
    if (isLoading) return;

    const currentPage = reset ? 0 : page;
    set({ isLoading: true });

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
      let query = supabase
        .from('profiles')
        .select('*, user_settings(profile_visible, show_online_status)')
        .neq('id', userId)
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

      // ── Age preference → birthdate range ──────────────────────────────────
      if (agePref?.min && agePref.min > 18) {
        const d = new Date(today.getFullYear() - agePref.min, today.getMonth(), today.getDate());
        query = query.lte('birthdate', d.toISOString().slice(0, 10));
      }
      if (agePref?.max && agePref.max < 100) {
        // Oldest person allowed: turned max_age this year but not yet max_age+1
        const d = new Date(today.getFullYear() - agePref.max - 1, today.getMonth(), today.getDate() + 1);
        query = query.gte('birthdate', d.toISOString().slice(0, 10));
      }

      // Manual filters
      if (filters.country)        query = query.eq('country', filters.country);
      if (filters.state)          query = query.eq('state', filters.state);
      if (filters.city)           query = query.eq('city', filters.city);
      if (filters.religion)       query = query.eq('religion', filters.religion);
      if (filters.online_only)    query = query.eq('online_status', 'online');

      query = query.order('last_seen', { ascending: false });

      const { data, error } = await query;

      const processRaw = (rows: any[]): User[] =>
        rows
          .map((u) => {
            const settings = (u as any).user_settings as
              | { profile_visible?: boolean; show_online_status?: boolean }
              | null;
            const bday = u.birthdate ? new Date(u.birthdate) : null;
            const age = bday
              ? today.getFullYear() - bday.getFullYear()
                - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
              : 0;
            const effectiveOnlineStatus =
              settings?.show_online_status === false ? 'offline' : u.online_status;
            return {
              ...u,
              age,
              online_status: effectiveOnlineStatus,
              user_settings: undefined,
              profile_photos: u.profile_photos ?? [],
              languages: u.languages ?? [],
            };
          })
          .filter((u) => {
            const raw = rows.find((d) => d.id === u.id);
            const settings = (raw as any)?.user_settings as { profile_visible?: boolean } | null;
            if (settings?.profile_visible === false) return false;
            if (filters.min_age && u.age < filters.min_age) return false;
            if (filters.max_age && u.age > filters.max_age) return false;
            return true;
          });

      if (!error && data) {
        const processed = processRaw(data);

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
            const { data: likedData } = await supabase
              .from('profiles')
              .select('*, user_settings(profile_visible, show_online_status)')
              .in('id', likedIdsArr)
              .limit(needed);
            if (likedData) {
              const likedUsers = processRaw(likedData);
              shuffleArray(likedUsers);
              result = [...result, ...likedUsers];
            }
          }
        }

        // Dev mock fallback — keep UI non-empty during development
        if (__DEV__ && currentPage === 0 && result.length === 0) {
          const realIds = new Set(result.map((u) => u.id));
          result = MOCK_USERS.filter((u) => {
            if (u.id === userId || realIds.has(u.id)) return false;
            if (genderFilter && u.gender !== genderFilter) return false;
            return true;
          }).slice(0, PAGE_SIZE);
        }

        set((state) => ({
          users: reset || currentPage === 0 ? result : [...state.users, ...result],
          page: currentPage + 1,
          hasMore: data.length === PAGE_SIZE,
        }));
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLikedUserIds: async (userId) => {
    const { data } = await supabase
      .from('likes')
      .select('to_user_id')
      .eq('from_user_id', userId);
    if (data) set({ likedUserIds: new Set(data.map((l) => l.to_user_id)) });
  },

  subscribeToOnlineStatus: () => {
    if (_subscribed) return;
    _subscribed = true;
    _realtimeChannel = supabase
      .channel('discover-online-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as { id?: string; online_status?: string; last_seen?: string };
          if (!updated?.id) return;
          set((state) => ({
            users: state.users.map((u) =>
              u.id === updated.id
                ? { ...u, online_status: (updated.online_status ?? u.online_status) as any, last_seen: updated.last_seen ?? u.last_seen }
                : u
            ),
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
      return false;
    }

    await supabase.from('likes').insert({ from_user_id: fromUserId, to_user_id: toUserId });
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
      notifyUser({ type: 'match', recipientId: toUserId,   senderId: fromUserId, senderName,        extra: { userId: fromUserId } });
      const { data: likedProfile } = await supabase.from('profiles').select('full_name').eq('id', toUserId).single();
      notifyUser({ type: 'match', recipientId: fromUserId, senderId: toUserId,   senderName: likedProfile?.full_name ?? 'Someone', extra: { userId: toUserId } });
    } else {
      notifyUser({ type: 'like', recipientId: toUserId, senderId: fromUserId, senderName, extra: { userId: fromUserId } });
    }
    return isMatch;
  },
}));
