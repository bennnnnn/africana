import type { SupabaseClient } from '@supabase/supabase-js';
import type { ThemePreference, UserSettings } from '@/types';

function normalizeTheme(v: unknown): ThemePreference {
  if (v === 'dark') return 'dark';
  return 'light';
}

/** DB payload for user_settings — columns PostgREST should receive on insert/update. */
export function mergeUserSettingsRow(
  userId: string,
  prev: UserSettings | null,
  patch: Partial<UserSettings>,
) {
  return {
    user_id: userId,
    receive_messages: patch.receive_messages ?? prev?.receive_messages ?? true,
    show_online_status: patch.show_online_status ?? prev?.show_online_status ?? true,
    profile_visible: patch.profile_visible ?? prev?.profile_visible ?? true,
    email_notifications: patch.email_notifications ?? prev?.email_notifications ?? true,
    notify_messages: patch.notify_messages ?? prev?.notify_messages ?? true,
    notify_likes: patch.notify_likes ?? prev?.notify_likes ?? true,
    notify_matches: patch.notify_matches ?? prev?.notify_matches ?? true,
    notify_views: patch.notify_views ?? prev?.notify_views ?? true,
    push_token: patch.push_token !== undefined ? patch.push_token : (prev?.push_token ?? null),
    theme: patch.theme ?? prev?.theme ?? 'light',
  };
}

export type UserSettingsRowPayload = ReturnType<typeof mergeUserSettingsRow>;

/**
 * Avoid PostgREST `upsert`: it runs an INSERT first, which often hits RLS before ON CONFLICT.
 * Use UPDATE when a row exists, INSERT otherwise.
 */
export async function persistUserSettingsRow(
  client: SupabaseClient,
  userId: string,
  row: UserSettingsRowPayload,
) {
  const { user_id: _omitUserId, ...patch } = row;
  const updateResult = await client
    .from('user_settings')
    .update(patch)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (updateResult.error) {
    return updateResult;
  }

  if (updateResult.data) {
    return updateResult;
  }

  return client.from('user_settings').insert(row).select().single();
}

export function rowToUserSettings(row: Record<string, unknown>): UserSettings {
  return {
    id: row.id as string | undefined,
    user_id: row.user_id as string,
    receive_messages: row.receive_messages !== false,
    show_online_status: row.show_online_status !== false,
    profile_visible: row.profile_visible !== false,
    email_notifications: row.email_notifications !== false,
    notify_messages: row.notify_messages !== false,
    notify_likes: row.notify_likes !== false,
    notify_matches: row.notify_matches !== false,
    notify_views: row.notify_views !== false,
    push_token: (row.push_token as string | null) ?? null,
    likes_seen_at: (row.likes_seen_at as string | null) ?? null,
    views_seen_at: (row.views_seen_at as string | null) ?? null,
    favourites_seen_at: (row.favourites_seen_at as string | null) ?? null,
    theme: normalizeTheme(row.theme),
  };
}
