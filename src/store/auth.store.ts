import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { User, UserSettings, InterestedIn } from '@/types';
import { supabase } from '@/lib/supabase';
import { oppositeInterestedIn } from '@/lib/gender-match';

interface AuthState {
  session: Session | null;
  user: User | null;
  settings: UserSettings | null;
  isLoading: boolean;
  /** true once the initial getSession() call has resolved — prevents premature logout on restart */
  isInitialized: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  /** Merge into current user (e.g. after presence update without full refetch) */
  patchUser: (partial: Partial<User>) => void;
  setSettings: (settings: UserSettings | null) => void;
  setInitialized: () => void;
  fetchProfile: (userId: string) => Promise<void>;
  fetchSettings: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updateSettings: (
    updates: Partial<UserSettings>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  settings: null,
  isLoading: false,
  isInitialized: false,

  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  patchUser: (partial) => {
    const { user } = get();
    if (!user) return;
    set({ user: { ...user, ...partial } });
  },
  setSettings: (settings) => set({ settings }),
  setInitialized: () => set({ isInitialized: true }),

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      set({ user: null });
      return;
    }

    const today = new Date();
    const bday  = data.birthdate ? new Date(data.birthdate) : null;
    const age   = bday
      ? today.getFullYear() - bday.getFullYear()
        - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
      : undefined;

    let interested_in = data.interested_in as InterestedIn;
    if (data.gender === 'male' || data.gender === 'female') {
      const aligned = oppositeInterestedIn(data.gender);
      if (data.interested_in !== aligned) {
        void supabase.from('profiles').update({ interested_in: aligned }).eq('id', userId);
      }
      interested_in = aligned;
    }

    set({
      user: {
        ...data,
        interested_in,
        age,
        profile_photos: data.profile_photos ?? [],
        languages: data.languages ?? [],
        hobbies: data.hobbies ?? [],
      },
    });
  },

  fetchSettings: async (userId) => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      set({ settings: data });
    } else {
      // No settings row yet — create defaults
      const defaults = {
        user_id: userId,
        receive_messages: true,
        show_online_status: true,
        profile_visible: true,
        email_notifications: true,
        notify_messages: true,
        notify_likes: true,
        notify_matches: true,
        notify_views: false,
        push_token: null,
        likes_seen_at: null,
        views_seen_at: null,
        favourites_seen_at: null,
        matches_seen_at: null,
        sent_seen_at: null,
      };
      const { data: created } = await supabase
        .from('user_settings')
        .upsert(defaults, { onConflict: 'user_id' })
        .select()
        .single();
      if (created) set({ settings: created });
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) {
      set({ user: { ...user, ...data, profile_photos: data.profile_photos ?? [], languages: data.languages ?? [], hobbies: data.hobbies ?? [] } });
    }
  },

  updateSettings: async (updates) => {
    const { user, settings } = get();
    if (!user) return { ok: false as const, message: 'Not signed in' };

    const previous = settings;
    const merged = { ...(settings ?? {}), ...updates, user_id: user.id };
    set({ settings: merged as UserSettings });

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(merged, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('[updateSettings]', error.message);
      set({ settings: previous });
      await get().fetchSettings(user.id);
      return { ok: false as const, message: error.message || 'Could not save settings' };
    }
    if (data) {
      set({ settings: data });
      if (
        'profile_visible' in updates ||
        'receive_messages' in updates ||
        'show_online_status' in updates
      ) {
        void get().fetchProfile(user.id);
      }
    }
    return { ok: true as const };
  },

  signOut: async () => {
    const { user } = get();
    if (user) {
      await supabase
        .from('profiles')
        .update({ online_status: 'offline', last_seen: new Date().toISOString() })
        .eq('id', user.id);
    }
    await supabase.auth.signOut();
    set({ session: null, user: null, settings: null });
  },
}));
