import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { createSessionFromUrl, getRedirectUri } from './google-auth';

/** Apple via Supabase OAuth (enable Apple provider in dashboard). Mirrors `signInWithGoogle`. */
export async function signInWithApple() {
  const redirectTo = getRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data?.url ?? '', redirectTo);
  if (result.type === 'success') {
    return await createSessionFromUrl(result.url);
  }
  return null;
}
