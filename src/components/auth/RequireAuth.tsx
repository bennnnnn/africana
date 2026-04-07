import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);

  if (!session?.user?.id) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <>{children}</>;
}
