import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { User, UserSettings } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  settings: UserSettings | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setSettings: (settings: UserSettings | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  fetchSettings: (userId: string) => Promise<void>;
  profileExists: (userId: string) => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  settings: null,
  isLoading: false,

  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setSettings: (settings) => set({ settings }),

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const today = new Date();
      const bday  = data.birthdate ? new Date(data.birthdate) : null;
      const age   = bday
        ? today.getFullYear() - bday.getFullYear()
          - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
        : undefined;
      set({ user: { ...data, age, profile_photos: data.profile_photos ?? [], languages: data.languages ?? [] } });
    }
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
      };
      const { data: created } = await supabase
        .from('user_settings')
        .upsert(defaults, { onConflict: 'user_id' })
        .select()
        .single();
      if (created) set({ settings: created });
    }
  },

  profileExists: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    return !!data;
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
      set({ user: { ...user, ...data, profile_photos: data.profile_photos ?? [], languages: data.languages ?? [] } });
    }
  },

  updateSettings: async (updates) => {
    const { user, settings } = get();
    if (!user) return;

    const merged = { ...(settings ?? {}), ...updates, user_id: user.id };
    const { data, error } = await supabase
      .from('user_settings')
      .upsert(merged, { onConflict: 'user_id' })
      .select()
      .single();

    if (!error && data) {
      set({ settings: data });
    }
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
