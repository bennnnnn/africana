import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, InteractionManager } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { createSessionFromUrl } from '@/lib/google-auth';
import {
  registerForPushNotifications,
  queueWelcomeEmail,
  resetLifecycleEmailQueue,
} from '@/lib/notifications';
import { initAnalytics, identify, resetAnalytics, track, EVENTS } from '@/lib/analytics';
import { initSentry, setSentryUser } from '@/lib/sentry';
import { hydrateProfileSeedCache } from '@/lib/profile-seed-cache';
import { redirectAfterAuth } from '@/lib/profile-completion';
import { logError, logWarn } from '@/lib/logger';
import { isUuidString } from '@/lib/utils';
import { TIMINGS } from '@/lib/timings';
import { resetClientModuleStateAtLogout } from '@/lib/reset-client-module-state-at-logout';
import { useAuthStore } from '@/store/auth.store';

type RouterLike = { push: (href: any) => void; replace: (href: any) => void };

const ONLINE_HEARTBEAT_MS = TIMINGS.presenceHeartbeatMs;

/**
 * Root app bootstrap + subscriptions (auth/session hydration, deep links, notifications, presence).
 * Extracted from `app/_layout.tsx` to keep RootLayout readable.
 */
export function useRootLayoutBootstrap(params: {
  router: RouterLike;
  fontsLoaded: boolean;
  setInitialized: () => void;
  setSession: (session: any) => void;
  hydrateUserFromServer: (userId: string, options?: { continueOnPartialFailure?: boolean }) => Promise<void>;
}) {
  const { router, fontsLoaded, setInitialized, setSession, hydrateUserFromServer } = params;

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const notifResponseSub = useRef<any>(null);
  const notifReceivedSub = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Do not `require('expo-notifications')` in Expo Go — it logs noisy errors.
  const isExpoGo = Constants.appOwnership === 'expo';
  let Notifications: typeof import('expo-notifications') | null = null;
  if (!isExpoGo) {
    try {
      Notifications = require('expo-notifications');
    } catch {
      // unsupported environment
    }
  }

  WebBrowser.maybeCompleteAuthSession();
  SplashScreen.preventAutoHideAsync();

  async function setOnlineStatus(userId: string, status: 'online' | 'offline') {
    await supabase
      .from('profiles')
      .update({ online_status: status, last_seen: new Date().toISOString() })
      .eq('id', userId);
  }

  async function pingLastSeen(userId: string) {
    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId);
  }

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
    initSentry();
    void hydrateProfileSeedCache().catch(() => {});
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
            await hydrateUserFromServer(session.user.id);
            const uid = session.user.id;
            setSentryUser(uid);
            useAuthStore.getState().patchUser({ online_status: 'online' });
            InteractionManager.runAfterInteractions(() => {
              void setOnlineStatus(uid, 'online').catch(() => {});
              startHeartbeat(uid);
              queueWelcomeEmail(uid);
              void registerForPushNotifications(uid).then((r) => {
                if (!r.ok && r.reason !== 'expo_go') {
                  logWarn('[push] register on bootstrap', { reason: r.reason, detail: r.detail ?? '' });
                }
              });
              identify(uid);
            });
          }
        } catch (e) {
          logError('Auth bootstrap error', e);
        } finally {
          finishBootstrap();
        }
      })
      .catch((e) => {
        logError('getSession failed', e);
        finishBootstrap();
      });

    if (Notifications?.addNotificationResponseReceivedListener) {
      notifResponseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, string> | undefined;
        if (data?.conversationId) {
          router.push(`/(chat)/${data.conversationId}`);
        } else if (data?.likesSegment && /^(matches|received|viewers|stars)$/.test(data.likesSegment)) {
          router.push({ pathname: '/(tabs)/likes', params: { tab: data.likesSegment } });
        } else if (data?.userId && isUuidString(data.userId)) {
          router.push(`/(profile)/${data.userId}`);
        }
      });
    }
    if (Notifications?.addNotificationReceivedListener) {
      notifReceivedSub.current = Notifications.addNotificationReceivedListener(() => {});
    }

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (!session?.user?.id) return;
          if (nextState === 'active' && prev !== 'active') {
            void setOnlineStatus(session.user.id, 'online').catch((e) => logError('setOnlineStatus', e));
            useAuthStore.getState().patchUser({ online_status: 'online' });
            startHeartbeat(session.user.id);
          } else if (nextState === 'background' || nextState === 'inactive') {
            stopHeartbeat();
            void setOnlineStatus(session.user.id, 'offline').catch((e) => logError('setOnlineStatus', e));
            useAuthStore.getState().patchUser({ online_status: 'offline' });
          }
        })
        .catch((e) => logError('getSession (appState)', e));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user?.id) {
        if (event === 'TOKEN_REFRESHED') return;
        const uid = session.user.id;
        setSentryUser(uid);
        void hydrateUserFromServer(uid, { continueOnPartialFailure: true });
        InteractionManager.runAfterInteractions(() => {
          queueWelcomeEmail(uid);
          void registerForPushNotifications(uid).then((r) => {
            if (!r.ok && r.reason !== 'expo_go') {
              logWarn('[push] register on auth change', { reason: r.reason, detail: r.detail ?? '' });
            }
          });
          identify(uid);
        });
        if (event === 'SIGNED_IN') {
          track(EVENTS.AUTH_LOGIN);
          startHeartbeat(uid);
        }
      } else if (event === 'SIGNED_OUT') {
        setSentryUser(null);
        resetClientModuleStateAtLogout();
        track(EVENTS.AUTH_SIGNOUT);
        resetAnalytics();
        resetLifecycleEmailQueue();
        stopHeartbeat();
        router.replace('/(auth)/welcome');
      }
    });

    const handleUrl = async ({ url }: { url: string }) => {
      if (url.includes('reset-password') || url.includes('type=recovery')) {
        router.push({ pathname: '/(auth)/reset-password', params: { url } });
        return;
      }
      if (url.includes('auth/callback') || url.includes('access_token')) {
        try {
          const session = await createSessionFromUrl(url);
          if (session?.user) {
            setSession(session);
            await hydrateUserFromServer(session.user.id);
            queueWelcomeEmail(session.user.id);
            void registerForPushNotifications(session.user.id).then((r) => {
              if (!r.ok && r.reason !== 'expo_go') {
                logWarn('[push] register on deep link', { reason: r.reason, detail: r.detail ?? '' });
              }
            });
            const { user } = useAuthStore.getState();
            redirectAfterAuth(router, user, session);
          }
        } catch (e) {
          logError('OAuth callback error', e);
        }
      }
    };

    Linking.getInitialURL()
      .then((url) => {
        if (url) void handleUrl({ url }).catch((e) => logError('Initial URL handler', e));
      })
      .catch((e) => logError('getInitialURL', e));
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl({ url }).catch((err) => logError('Deep link handler', err));
    });

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
      appStateSub.remove();
      notifResponseSub.current?.remove();
      notifReceivedSub.current?.remove();
      stopHeartbeat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);
}

