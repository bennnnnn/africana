import { create } from 'zustand';
import { User, FilterOptions } from '@/types';
import { supabase } from '@/lib/supabase';

interface DiscoverState {
  users: User[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  filters: FilterOptions;
  likedUserIds: Set<string>;
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  fetchUsers: (userId: string, reset?: boolean) => Promise<void>;
  toggleLike: (fromUserId: string, toUserId: string) => Promise<void>;
  fetchLikedUserIds: (userId: string) => Promise<void>;
}

const DEFAULT_FILTERS: FilterOptions = {
  country: null,
  state: null,
  city: null,
  gender: null,
  min_age: 18,
  max_age: 80,
  looking_for: null,
  online_only: false,
};

const PAGE_SIZE = 20;

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

  fetchUsers: async (userId, reset = false) => {
    const { filters, page, isLoading } = get();
    if (isLoading) return;

    const currentPage = reset ? 0 : page;
    set({ isLoading: true });

    try {
      // Get blocked user ids
      const { data: blocks } = await supabase
        .from('blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

      const blockedIds = blocks?.map((b) =>
        b.blocker_id === userId ? b.blocked_id : b.blocker_id
      ) ?? [];

      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', userId)
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (blockedIds.length > 0) {
        query = query.not('id', 'in', `(${blockedIds.join(',')})`);
      }

      if (filters.country) query = query.eq('country', filters.country);
      if (filters.state) query = query.eq('state', filters.state);
      if (filters.city) query = query.eq('city', filters.city);
      if (filters.gender) query = query.eq('gender', filters.gender);
      if (filters.online_only) query = query.eq('online_status', 'online');

      const { data, error } = await query.order('online_status', { ascending: true }).order('last_seen', { ascending: false });

      if (!error && data) {
        const today = new Date();
        const usersWithAge = data
          .map((u) => {
            const birthdate = new Date(u.birthdate);
            const age = today.getFullYear() - birthdate.getFullYear();
            return { ...u, age };
          })
          .filter((u) => {
            if (filters.min_age && u.age < filters.min_age) return false;
            if (filters.max_age && u.age > filters.max_age) return false;
            if (filters.looking_for && !u.looking_for.includes(filters.looking_for)) return false;
            return true;
          });

        set((state) => ({
          users: reset || currentPage === 0 ? usersWithAge : [...state.users, ...usersWithAge],
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

    if (data) {
      set({ likedUserIds: new Set(data.map((l) => l.to_user_id)) });
    }
  },

  toggleLike: async (fromUserId, toUserId) => {
    const { likedUserIds } = get();
    const isLiked = likedUserIds.has(toUserId);

    if (isLiked) {
      await supabase.from('likes').delete().eq('from_user_id', fromUserId).eq('to_user_id', toUserId);
      set((state) => {
        const newSet = new Set(state.likedUserIds);
        newSet.delete(toUserId);
        return { likedUserIds: newSet };
      });
    } else {
      await supabase.from('likes').insert({ from_user_id: fromUserId, to_user_id: toUserId });
      set((state) => {
        const newSet = new Set(state.likedUserIds);
        newSet.add(toUserId);
        return { likedUserIds: newSet };
      });
    }
  },
}));
