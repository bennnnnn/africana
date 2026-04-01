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
      const birthdate = new Date(data.birthdate);
      const today = new Date();
      const age = today.getFullYear() - birthdate.getFullYear();
      set({ user: { ...data, age } });
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

    if (!error && data) {
      set({ user: { ...user, ...data } });
    }
  },

  updateSettings: async (updates) => {
    const { user, settings } = get();
    if (!user || !settings) return;

    const { data, error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();

    if (!error && data) {
      set({ settings: data });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, settings: null });
  },
}));
