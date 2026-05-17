import type { Session } from '@supabase/supabase-js';
import type { User, UserSettings, Gender } from '@/types';
import { PROFILE_LIST_SELECT } from '@/constants/profile-select';
import { supabase } from '@/lib/supabase';
import { normalizeInterestedInFromDb } from '@/lib/gender-match';

export async function fetchProfileRow(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_LIST_SELECT as '*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;

  const today = new Date();
  const bday = data.birthdate
    ? (() => {
        const [y, m, d] = (data.birthdate as string).split('-').map(Number);
        return new Date(y, m - 1, d); // local date — avoids UTC-midnight off-by-one
      })()
    : null;
  const age = bday
    ? today.getFullYear() -
      bday.getFullYear() -
      (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
    : undefined;

  const rawGender = String(data.gender ?? '');
  const validGenders = new Set<string>(['male', 'female', 'nonbinary', 'other']);
  const gender: Gender = validGenders.has(rawGender) ? (rawGender as Gender) : 'other';
  const interested_in = normalizeInterestedInFromDb(
    gender,
    data.interested_in as string | null | undefined,
  );

  const profileFix: { gender?: Gender; interested_in?: typeof interested_in } = {};
  if (gender !== data.gender) profileFix.gender = gender;
  if (interested_in !== data.interested_in) profileFix.interested_in = interested_in;
  if (Object.keys(profileFix).length) {
    void supabase.from('profiles').update(profileFix).eq('id', userId);
  }

  return {
    ...data,
    // Email is no longer stored on public.profiles (it would leak via a permissive SELECT policy).
    email: null,
    gender,
    interested_in,
    age,
    profile_photos: data.profile_photos ?? [],
    languages: data.languages ?? [],
    hobbies: data.hobbies ?? [],
  } as User;
}

export function withSessionEmail(user: User, session: Session | null): User {
  const sessionEmail = session?.user?.email ?? null;
  return { ...user, email: sessionEmail };
}

export async function fetchOrCreateSettingsRow(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!error && data) return data as UserSettings;

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
  return (created as UserSettings) ?? null;
}
