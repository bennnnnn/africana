import { create } from 'zustand';
import { User, FilterOptions, InterestedIn } from '@/types';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { MOCK_USERS } from '@/lib/mock-data';

// Map the user's "interested_in" preference → which genders to show
const interestedInToGender = (v: InterestedIn | undefined): string | null => {
  if (v === 'men')   return 'male';
  if (v === 'women') return 'female';
  return null; // 'everyone' → no filter
};

interface DiscoverState {
  users: User[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  filters: FilterOptions;
  likedUserIds: Set<string>;
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  fetchUsers: (userId: string, interestedIn?: InterestedIn, reset?: boolean) => Promise<void>;
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
  marital_status: null,
  online_only: false,
};

const PAGE_SIZE = 10;

// Channel ref lives outside Zustand (not serialisable)
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

  fetchUsers: async (userId, interestedIn, reset = false) => {
    const { filters, page, isLoading } = get();
    if (isLoading) return;

    const currentPage = reset ? 0 : page;
    set({ isLoading: true });

    try {
      // Get blocked user ids (both directions)
      const { data: blocks } = await supabase
        .from('blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

      const blockedIds = blocks?.map((b) =>
        b.blocker_id === userId ? b.blocked_id : b.blocker_id
      ) ?? [];

      // Join user_settings to enforce profile_visible and show_online_status
      let query = supabase
        .from('profiles')
        .select('*, user_settings(profile_visible, show_online_status)')
        .neq('id', userId)
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (blockedIds.length > 0) {
        query = query.not('id', 'in', `(${blockedIds.join(',')})`);
      }

      // Auto-apply gender based on the current user's "interested_in" preference
      const genderFilter = interestedInToGender(interestedIn);
      if (genderFilter) query = query.eq('gender', genderFilter);

      if (filters.country) query = query.eq('country', filters.country);
      if (filters.state) query = query.eq('state', filters.state);
      if (filters.city) query = query.eq('city', filters.city);
      if (filters.religion) query = query.eq('religion', filters.religion);
      if (filters.marital_status) query = query.eq('marital_status', filters.marital_status);
      if (filters.online_only) query = query.eq('online_status', 'online');

      // Sort online users first; use last_seen desc for DB ordering
      const { data, error } = await query.order('last_seen', { ascending: false });

      if (!error && data) {
        const today = new Date();
        const usersWithAge = data
          .map((u) => {
            const settings = (u as any).user_settings as { profile_visible?: boolean; show_online_status?: boolean } | null;
            const bday = u.birthdate ? new Date(u.birthdate) : null;
            const age = bday
              ? today.getFullYear() - bday.getFullYear()
                - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
              : 0;
            // Mask online status if user chose to hide it
            const effectiveOnlineStatus =
              settings?.show_online_status === false ? 'offline' : u.online_status;
            return { ...u, age, online_status: effectiveOnlineStatus, user_settings: undefined, profile_photos: u.profile_photos ?? [], languages: u.languages ?? [] };
          })
          .filter((u) => {
            // Exclude profiles hidden from discovery
            const raw = data.find((d) => d.id === u.id);
            const settings = (raw as any)?.user_settings as { profile_visible?: boolean } | null;
            if (settings?.profile_visible === false) return false;
            if (filters.min_age && u.age < filters.min_age) return false;
            if (filters.max_age && u.age > filters.max_age) return false;
            return true;
          });

        // Sort so online users appear first
        usersWithAge.sort((a, b) => {
          const aOnline = (a as any).online_status === 'online' ? 0 : 1;
          const bOnline = (b as any).online_status === 'online' ? 0 : 1;
          return aOnline - bOnline;
        });

        // In development only: pad first page with mock users so UI is never empty
        let result = usersWithAge;
        if (__DEV__ && currentPage === 0) {
          const realIds = new Set(usersWithAge.map((u) => u.id));
          const needed = Math.max(0, PAGE_SIZE - usersWithAge.length);
          const mockFill = MOCK_USERS
            .filter((u) => {
              if (u.id === userId || realIds.has(u.id)) return false;
              if (genderFilter && u.gender !== genderFilter) return false;
              return true;
            })
            .slice(0, needed);
          result = [...usersWithAge, ...mockFill];
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

    if (data) {
      set({ likedUserIds: new Set(data.map((l) => l.to_user_id)) });
    }
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
        const newSet = new Set(state.likedUserIds);
        newSet.delete(toUserId);
        return { likedUserIds: newSet };
      });
      return false;
    } else {
      await supabase.from('likes').insert({ from_user_id: fromUserId, to_user_id: toUserId });
      set((state) => {
        const newSet = new Set(state.likedUserIds);
        newSet.add(toUserId);
        return { likedUserIds: newSet };
      });

      // Get sender's name for notifications
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', fromUserId)
        .single();
      const senderName = senderProfile?.full_name ?? 'Someone';

      // Check for mutual match
      const { data: mutual } = await supabase
        .from('likes')
        .select('id')
        .eq('from_user_id', toUserId)
        .eq('to_user_id', fromUserId)
        .maybeSingle();

      const isMatch = !!mutual;

      if (isMatch) {
        // Notify BOTH users of the match
        notifyUser({ type: 'match', recipientId: toUserId,   senderId: fromUserId, senderName,                     extra: { userId: fromUserId } });
        // Fetch the liked user's name to notify the liker too
        const { data: likedProfile } = await supabase
          .from('profiles').select('full_name').eq('id', toUserId).single();
        const likedName = likedProfile?.full_name ?? 'Someone';
        notifyUser({ type: 'match', recipientId: fromUserId, senderId: toUserId,   senderName: likedName, extra: { userId: toUserId } });
      } else {
        // Notify recipient of the like
        notifyUser({ type: 'like', recipientId: toUserId, senderId: fromUserId, senderName, extra: { userId: fromUserId } });
      }
      return isMatch;
    }
  },
}));
