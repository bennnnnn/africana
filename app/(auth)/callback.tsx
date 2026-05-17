import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { createSessionFromUrl } from '@/lib/google-auth';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/store/auth.store';
import { redirectAfterAuth } from '@/lib/profile-completion';
import { COLORS } from '@/constants';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { hydrateUserFromServer, setSession } = useAuthStore(
    useShallow((s) => ({
      hydrateUserFromServer: s.hydrateUserFromServer,
      setSession: s.setSession,
    })),
  );

  useEffect(() => {
    let cancelled = false;

    const finishAuth = async (url: string) => {
      const session = await createSessionFromUrl(url);
      if (cancelled) return;
      try {
        if (session?.user) {
          setSession(session);
          await hydrateUserFromServer(session.user.id);
          if (cancelled) return;
          const { user } = useAuthStore.getState();
          redirectAfterAuth(router, user, session);
        } else {
          router.replace('/(auth)/welcome');
        }
      } catch {
        router.replace('/(auth)/welcome');
      }
    };

    const run = async () => {
      const url = buildCallbackUrl(params);
      if (url) {
        await finishAuth(url);
        return;
      }

      // Expo Go/tunnel can open this route while the OAuth tokens live only in
      // the raw initial URL fragment. Wait for that before falling back, so the
      // public welcome screen doesn't flash before the real auth redirect wins.
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (cancelled) return;
      if (
        initialUrl &&
        (initialUrl.includes('auth/callback') ||
          initialUrl.includes('access_token') ||
          initialUrl.includes('code='))
      ) {
        await finishAuth(initialUrl);
        return;
      }

      setTimeout(() => {
        if (!cancelled) router.replace('/(auth)/welcome');
      }, 1500);
    };

    run().catch(() => {
      if (!cancelled) router.replace('/(auth)/welcome');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

function buildCallbackUrl(params: Record<string, unknown>): string | undefined {
  const nestedUrl = params?.url;
  if (typeof nestedUrl === 'string' && nestedUrl.length > 0) return nestedUrl;

  const entries = Object.entries(params)
    .flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((v) => [key, v] as const) : [[key, value] as const],
    )
    .filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string');

  if (
    !entries.some(
      ([key]) =>
        key === 'access_token' || key === 'code' || key === 'error_code' || key === 'error',
    )
  ) {
    return undefined;
  }

  const query = new URLSearchParams(entries as unknown as string[][]).toString();
  return `africana://auth/callback#${query}`;
}
