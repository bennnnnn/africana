import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { createSessionFromUrl } from '@/lib/google-auth';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/store/auth.store';
import { redirectAfterAuth } from '@/lib/profile-completion';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { hydrateUserFromServer, setSession } = useAuthStore(
    useShallow((s) => ({
      hydrateUserFromServer: s.hydrateUserFromServer,
      setSession: s.setSession,
    })),
  );

  useEffect(() => {
    const url = params?.url as string | undefined;
    if (!url) {
      router.replace('/(auth)/welcome');
      return;
    }

    createSessionFromUrl(url)
      .then(async (session) => {
        try {
          if (session?.user) {
            setSession(session);
            await hydrateUserFromServer(session.user.id);
            const { user } = useAuthStore.getState();
            redirectAfterAuth(router, user, session);
          } else {
            router.replace('/(auth)/welcome');
          }
        } catch {
          router.replace('/(auth)/welcome');
        }
      })
      .catch(() => router.replace('/(auth)/welcome'));
  }, []);

  return null;
}
