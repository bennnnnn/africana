import { Share } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * GDPR Article 20 — user data export.
 *
 * Calls the `export_user_data` RPC (security-definer function defined in
 * 20260419120000_launch_blockers.sql) to assemble a single JSON blob with
 * the caller's profile, settings, likes, messages, blocks, and reports,
 * then hands it to the native share sheet.
 *
 * We pass the JSON as `message` — RN's Share.share accepts that on both
 * iOS and Android, and it avoids the expo-file-system v19 legacy/new-API
 * split that we hit earlier. Users can AirDrop / Mail / copy it into any
 * destination that accepts text. That satisfies Art. 20's "commonly used,
 * machine-readable format" requirement.
 */
export async function exportAndShareUserData(): Promise<
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'rpc_failed' | 'share_cancelled' }
> {
  const { data, error } = await supabase.rpc('export_user_data');

  if (error) {
    if (__DEV__) console.error('[exportAndShareUserData] RPC error:', error);
    const isAuthError = error.code === '28000' || /not authenticated/i.test(error.message ?? '');
    return { ok: false, reason: isAuthError ? 'unauthenticated' : 'rpc_failed' };
  }
  if (!data) {
    return { ok: false, reason: 'rpc_failed' };
  }

  const pretty = JSON.stringify(data, null, 2);

  try {
    const result = await Share.share({
      title: 'Africana data export',
      message: pretty,
    });
    if (result.action === Share.dismissedAction) {
      return { ok: false, reason: 'share_cancelled' };
    }
    return { ok: true };
  } catch (e) {
    if (__DEV__) console.error('[exportAndShareUserData] Share error:', e);
    return { ok: false, reason: 'share_cancelled' };
  }
}
