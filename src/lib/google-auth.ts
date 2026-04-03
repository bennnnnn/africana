import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const getRedirectUri = () =>
  makeRedirectUri({ scheme: 'africana', path: 'auth/callback' });

export const createSessionFromUrl = async (url: string) => {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
};

export const signInWithGoogle = async () => {
  const redirectTo = getRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data?.url ?? '', redirectTo);

  if (result.type === 'success') {
    return await createSessionFromUrl(result.url);
  }

  return null;
};
