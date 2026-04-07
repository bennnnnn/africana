import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch {}
import { registerForPushNotifications } from '@/lib/notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { createSessionFromUrl } from '@/lib/google-auth';
import { useAuthStore } from '@/store/auth.store';

WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync();

/** Update online_status in the database */
async function setOnlineStatus(userId: string, status: 'online' | 'offline') {
  await supabase
    .from('profiles')
    .update({ online_status: status, last_seen: new Date().toISOString() })
    .eq('id', userId);
}

export default function RootLayout() {
  const { setSession, fetchProfile, fetchSettings, profileExists, setInitialized } = useAuthStore();
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const notifResponseSub = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        fetchProfile(session.user.id);
        fetchSettings(session.user.id).then(() => {
          const { settings } = useAuthStore.getState();
          if (settings?.show_online_status !== false) {
            setOnlineStatus(session.user.id, 'online');
          }
          registerForPushNotifications(session.user.id);
        });
      }
      // Mark auth as resolved — index.tsx waits for this before routing
      setInitialized();
      SplashScreen.hideAsync();
    });

    // Handle notification taps — navigate to the right screen (not available in Expo Go)
    if (Notifications?.addNotificationResponseReceivedListener) {
      notifResponseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, string> | undefined;
        if (data?.conversationId) {
          router.push(`/(chat)/${data.conversationId}`);
        } else if (data?.userId) {
          router.push(`/(profile)/${data.userId}`);
        }
      });
    }

    // Track foreground/background to update online status
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user?.id) return;
        const { settings } = useAuthStore.getState();
        if (nextState === 'active' && prev !== 'active') {
          if (settings?.show_online_status !== false) {
            setOnlineStatus(session.user.id, 'online');
          }
        } else if (nextState === 'background' || nextState === 'inactive') {
          // Always mark offline on background regardless of show_online_status
          // so stale "online" pins don't persist after the user leaves the app
          setOnlineStatus(session.user.id, 'offline');
        }
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user?.id) {
        fetchProfile(session.user.id);
        fetchSettings(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // Only redirect on explicit sign-out, not on initial load
        router.replace('/(auth)/welcome');
      }
    });

    // Handle OAuth deep link callbacks + password reset
    const handleUrl = async ({ url }: { url: string }) => {
      // Password reset link (africana://reset-password?access_token=...)
      if (url.includes('reset-password') || url.includes('type=recovery')) {
        router.push({ pathname: '/(auth)/reset-password', params: { url } });
        return;
      }
      if (url.includes('auth/callback') || url.includes('access_token')) {
        try {
          const session = await createSessionFromUrl(url);
          if (session?.user) {
            setSession(session);
            const hasProfile = await profileExists(session.user.id);
            if (hasProfile) {
              await fetchProfile(session.user.id);
              await fetchSettings(session.user.id);
              router.replace('/(tabs)/discover');
            } else {
              router.replace({
                pathname: '/(auth)/onboarding',
                params: { userId: session.user.id, email: session.user.email ?? '' },
              });
            }
          }
        } catch (e) {
          console.error('OAuth callback error', e);
        }
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }); });
    const linkSub = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
      appStateSub.remove();
      notifResponseSub.current?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(profile)" />
        <Stack.Screen name="(chat)" />
        <Stack.Screen name="(settings)" />
      </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
