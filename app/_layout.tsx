import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { registerForPushNotifications } from '@/lib/notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Native keyboard inset provider. This is the only reliable way to handle
// keyboard insets on Android edge-to-edge across OEMs (Samsung, MIUI,
// ColorOS, etc.) — it reads insets from `WindowInsetsCompat` natively
// instead of guessing them from JS-side keyboard events. Bundled in Expo
// Go SDK 54+, so no dev build required.
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { createSessionFromUrl } from '@/lib/google-auth';
import { useAuthStore } from '@/store/auth.store';
import { isProfileCompleteForDiscover, onboardingHrefFromSession } from '@/lib/profile-completion';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DialogProvider } from '@/components/ui/DialogProvider';
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { clearProfileSeedCache, hydrateProfileSeedCache } from '@/lib/profile-seed-cache';
import { initAnalytics, identify, resetAnalytics, track, EVENTS } from '@/lib/analytics';

/** Optional: Expo Go may not ship expo-notifications — load after all imports (valid ESM). */
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  // unavailable in some environments
}

WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync();

/** Update online_status in the database */
async function setOnlineStatus(userId: string, status: 'online' | 'offline') {
  await supabase
    .from('profiles')
    .update({ online_status: status, last_seen: new Date().toISOString() })
    .eq('id', userId);
}

/** Refresh just `last_seen` so other clients can tell we're still here. */
async function pingLastSeen(userId: string) {
  await supabase
    .from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', userId);
}

/**
 * Heartbeat interval. The freshness window in `src/lib/utils.ts` is set to
 * 3 minutes, so 60 s gives us two missed pings of grace before another
 * client decides we're offline.
 */
const ONLINE_HEARTBEAT_MS = 60 * 1000;

export default function RootLayout() {
  const { setSession, fetchProfile, fetchSettings, setInitialized } = useAuthStore();
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const notifResponseSub = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [fontsLoaded] = useFonts({ DMSerifDisplay_400Regular });

  /**
   * Keep the per-minute "I'm still here" heartbeat alive while the app is in
   * the foreground. Without this, presence relies entirely on the boot-time
   * UPDATE — and that's exactly why other users were showing as online even
   * when they were clearly offline (force-quit, crash, network drop, OS
   * termination, etc. all skip the AppState→background transition).
   */
  const startHeartbeat = (userId: string) => {
    if (heartbeatRef.current) return;
    heartbeatRef.current = setInterval(() => {
      void pingLastSeen(userId).catch(() => {});
    }, ONLINE_HEARTBEAT_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  useEffect(() => {
    // Rehydrate the profile-seed cache from disk so opening a profile after a
    // cold start is still instant (the in-memory Map is otherwise empty).
    void hydrateProfileSeedCache().catch(() => {});

    // Boot analytics ASAP — it queues events until init completes so the
    // very first screen's events aren't dropped.
    void initAnalytics();

    const finishBootstrap = () => {
      setInitialized();
      if (fontsLoaded) {
        void SplashScreen.hideAsync().catch(() => {});
      }
    };

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        try {
          setSession(session);
          if (session?.user?.id) {
            // Critical-path: profile + settings must land before we route the
            // user. Everything else (presence, push, analytics) is deferred
            // until after the first frame so the splash hides on time.
            await fetchProfile(session.user.id);
            await fetchSettings(session.user.id);
            const uid = session.user.id;
            useAuthStore.getState().patchUser({ online_status: 'online' });
            InteractionManager.runAfterInteractions(() => {
              void setOnlineStatus(uid, 'online').catch(() => {});
              startHeartbeat(uid);
              void registerForPushNotifications(uid).then((r) => {
                if (!r.ok) console.warn('[push] register on bootstrap:', r.reason, r.detail ?? '');
              });
              identify(uid);
            });
          }
        } catch (e) {
          console.error('Auth bootstrap error', e);
        } finally {
          finishBootstrap();
        }
      })
      .catch((e) => {
        console.error('getSession failed', e);
        finishBootstrap();
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
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (!session?.user?.id) return;
          if (nextState === 'active' && prev !== 'active') {
            void setOnlineStatus(session.user.id, 'online').catch((e) => console.error('setOnlineStatus', e));
            useAuthStore.getState().patchUser({ online_status: 'online' });
            startHeartbeat(session.user.id);
          } else if (nextState === 'background' || nextState === 'inactive') {
            stopHeartbeat();
            void setOnlineStatus(session.user.id, 'offline').catch((e) => console.error('setOnlineStatus', e));
            useAuthStore.getState().patchUser({ online_status: 'offline' });
          }
        })
        .catch((e) => console.error('getSession (appState)', e));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user?.id) {
        const uid = session.user.id;
        void fetchProfile(uid).catch((e) => console.error('fetchProfile (auth change)', e));
        void fetchSettings(uid).catch((e) => console.error('fetchSettings (auth change)', e));
        InteractionManager.runAfterInteractions(() => {
          void registerForPushNotifications(uid).then((r) => {
            if (!r.ok) console.warn('[push] register on auth change:', r.reason, r.detail ?? '');
          });
          identify(uid);
        });
        if (event === 'SIGNED_IN') {
          track(EVENTS.AUTH_LOGIN);
          startHeartbeat(uid);
        }
      } else if (event === 'SIGNED_OUT') {
        track(EVENTS.AUTH_SIGNOUT);
        resetAnalytics();
        stopHeartbeat();
        void clearProfileSeedCache().catch(() => {});
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
            await fetchProfile(session.user.id);
            await fetchSettings(session.user.id);
            void registerForPushNotifications(session.user.id).then((r) => {
              if (!r.ok) console.warn('[push] register on deep link:', r.reason, r.detail ?? '');
            });
            const { user } = useAuthStore.getState();
            if (isProfileCompleteForDiscover(user)) {
              router.replace('/(tabs)/discover');
            } else {
              router.replace(onboardingHrefFromSession(session));
            }
          }
        } catch (e) {
          console.error('OAuth callback error', e);
        }
      }
    };

    Linking.getInitialURL()
      .then((url) => {
        if (url) void handleUrl({ url }).catch((e) => console.error('Initial URL handler', e));
      })
      .catch((e) => console.error('getInitialURL', e));
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl({ url }).catch((err) => console.error('Deep link handler', err));
    });

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
      appStateSub.remove();
      notifResponseSub.current?.remove();
      stopHeartbeat();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <DialogProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="(profile)"
                options={{
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen name="(chat)" />
              <Stack.Screen name="(settings)" />
            </Stack>
          </DialogProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
