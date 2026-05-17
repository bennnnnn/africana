import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { User, UserSettings } from '@/types';
import { supabase } from '@/lib/supabase';
import { resetRateLimitWarnings } from '@/lib/rate-limit-warn';
import { resetFreeQuotaCache } from '@/lib/free-quota';
import { teardownPayments } from '@/lib/payments';
import {
  fetchOrCreateSettingsRow,
  fetchProfileRow,
  withSessionEmail,
} from '@/lib/auth-profile-settings';

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
  /** Load profile + settings together (auth bootstrap, OAuth, login). */
  hydrateUserFromServer: (
    userId: string,
    options?: { continueOnPartialFailure?: boolean },
  ) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updateSettings: (
    updates: Partial<UserSettings>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
}

/** Serialize concurrent updateSettings calls to prevent lost-write races. */
let updateSettingsPending: Promise<void> = Promise.resolve();

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
    const row = await fetchProfileRow(userId);
    if (!row) {
      set({ user: null });
      return;
    }
    set({ user: withSessionEmail(row, get().session) });
  },

  fetchSettings: async (userId) => {
    const row = await fetchOrCreateSettingsRow(userId);
    if (row) set({ settings: row });
  },

  hydrateUserFromServer: async (userId, options) => {
    set({ isLoading: true });
    try {
      if (options?.continueOnPartialFailure) {
        await Promise.all([
          get()
            .fetchProfile(userId)
            .catch((e) => console.error('fetchProfile (auth change)', e)),
          get()
            .fetchSettings(userId)
            .catch((e) => console.error('fetchSettings (auth change)', e)),
        ]);
        return;
      }
      await Promise.all([get().fetchProfile(userId), get().fetchSettings(userId)]);
    } finally {
      set({ isLoading: false });
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
      set({
        user: {
          ...user,
          ...data,
          profile_photos: data.profile_photos ?? [],
          languages: data.languages ?? [],
          hobbies: data.hobbies ?? [],
        },
      });
    }
  },

  updateSettings: async (updates) => {
    // Serialize calls so two rapid updates don't race on the same settings snapshot.
    const previousPromise = updateSettingsPending;
    let resolve: () => void;
    updateSettingsPending = new Promise<void>((r) => { resolve = r; });

    try {
      await previousPromise;
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
    } finally {
      resolve!();
    }
  },

  signOut: async () => {
    const { user } = get();
    if (user) {
      const results = await Promise.allSettled([
        supabase.from('user_settings').update({ push_token: null }).eq('user_id', user.id),
        supabase
          .from('profiles')
          .update({ online_status: 'offline', last_seen: new Date().toISOString() })
          .eq('id', user.id),
      ]);
      for (const r of results) {
        if (r.status === 'rejected') {
          console.warn('[signOut] best-effort profile/settings update failed', r.reason);
        } else if (r.value.error) {
          console.warn('[signOut]', r.value.error.message);
        }
      }
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[signOut] auth.signOut failed', e);
    } finally {
      resetRateLimitWarnings();
      resetFreeQuotaCache();
      void teardownPayments();
      set({ session: null, user: null, settings: null });
    }
  },
}));
