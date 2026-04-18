import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { createSessionFromUrl } from '@/lib/google-auth';
import { useAuthStore } from '@/store/auth.store';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { fetchProfile, fetchSettings, setSession } = useAuthStore();

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
            await fetchProfile(session.user.id);
            await fetchSettings(session.user.id);
            router.replace('/(tabs)/discover');
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
