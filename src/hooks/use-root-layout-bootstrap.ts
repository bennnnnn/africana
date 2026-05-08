import { useEffect, useMemo, useRef } from 'react';
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
import { resetClientModuleStateAtLogout } from '@/lib/reset-client-module-state-at-logout';
import { joinAppPresenceChannel, leaveAppPresenceChannel } from '@/lib/app-presence-channel';
import { useAuthStore } from '@/store/auth.store';

type RouterLike = { push: (href: any) => void; replace: (href: any) => void };

/**
 * Root app bootstrap + subscriptions (auth/session hydration, deep links, notifications, presence).
 * Extracted from `app/_layout.tsx` to keep RootLayout readable.
 */
export function useRootLayoutBootstrap(params: {
  router: RouterLike;
  fontsLoaded: boolean;
  setInitialized: () => void;
  setSession: (session: any) => void;
  hydrateUserFromServer: (
    userId: string,
    options?: { continueOnPartialFailure?: boolean },
  ) => Promise<void>;
}) {
  const { router, fontsLoaded, setInitialized, setSession, hydrateUserFromServer } = params;

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const notifResponseSub = useRef<any>(null);
  const notifReceivedSub = useRef<any>(null);
  const bootHydratedUserId = useRef<string | null>(null);

  const expectedScheme = useMemo(() => {
    // Expo Go uses exp+<scheme>. In builds, it's usually just <scheme>.
    // We accept both but reject anything else.
    const scheme = Linking.createURL('')?.split('://')[0] ?? 'africana';
    // When Linking.createURL returns e.g. "exp+africana://", split gives "exp+africana".
    // The base scheme for this app is "africana".
    return scheme.includes('africana') ? 'africana' : scheme;
  }, []);

  function isTrustedInboundUrl(url: string): boolean {
    try {
      const parsed = Linking.parse(url);
      const schemeOk = parsed.scheme === 'africana' || parsed.scheme === `exp+africana`;
      if (!schemeOk) return false;
      // Only accept the specific in-app auth/reset endpoints.
      const path = (parsed.path ?? '').replace(/^\//, '');
      if (path === 'auth/callback') return true;
      if (path === 'reset-password') return true;
      return false;
    } catch {
      return false;
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

  useEffect(() => {
    let cancelled = false;
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
            const uid = session.user.id;
            // Avoid double-hydration when onAuthStateChange fires INITIAL_SESSION.
            bootHydratedUserId.current = uid;
            await hydrateUserFromServer(uid);
            setSentryUser(uid);
            useAuthStore.getState().patchUser({ online_status: 'online' });
            InteractionManager.runAfterInteractions(() => {
              void setOnlineStatus(uid, 'online').catch(() => {});
              void joinAppPresenceChannel(uid).catch((e) =>
                logWarn('[presence] bootstrap join', e),
              );
              queueWelcomeEmail(uid);
              void registerForPushNotifications(uid).then((r) => {
                if (!r.ok && r.reason !== 'expo_go') {
                  logWarn('[push] register on bootstrap', {
                    reason: r.reason,
                    detail: r.detail ?? '',
                  });
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

    if (Constants.appOwnership !== 'expo') {
      void import('expo-notifications')
        .then((Notifications) => {
          if (cancelled) return;
          if (Notifications.addNotificationResponseReceivedListener) {
            notifResponseSub.current = Notifications.addNotificationResponseReceivedListener(
              (response) => {
                const data = response.notification.request.content.data as
                  | Record<string, string>
                  | undefined;
                if (data?.conversationId) {
                  router.push(`/(chat)/${data.conversationId}`);
                } else if (
                  data?.likesSegment &&
                  /^(matches|received|viewers|stars)$/.test(data.likesSegment)
                ) {
                  router.push({ pathname: '/(tabs)/likes', params: { tab: data.likesSegment } });
                } else if (data?.userId && isUuidString(data.userId)) {
                  router.push(`/(profile)/${data.userId}`);
                }
              },
            );
          }
          if (Notifications.addNotificationReceivedListener) {
            notifReceivedSub.current = Notifications.addNotificationReceivedListener(() => {});
          }
        })
        .catch(() => {
          /* native module unavailable */
        });
    }

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (!session?.user?.id) return;
          if (nextState === 'active' && prev !== 'active') {
            void setOnlineStatus(session.user.id, 'online').catch((e) =>
              logError('setOnlineStatus', e),
            );
            useAuthStore.getState().patchUser({ online_status: 'online' });
            void joinAppPresenceChannel(session.user.id).catch((e) =>
              logWarn('[presence] foreground join', e),
            );
          } else if (nextState === 'background' || nextState === 'inactive') {
            void leaveAppPresenceChannel().catch(() => {});
            void setOnlineStatus(session.user.id, 'offline').catch((e) =>
              logError('setOnlineStatus', e),
            );
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
        if (event === 'INITIAL_SESSION' && bootHydratedUserId.current === uid) {
          // Boot path already hydrated this user.
          return;
        }
        setSentryUser(uid);
        void hydrateUserFromServer(uid, { continueOnPartialFailure: true });
        InteractionManager.runAfterInteractions(() => {
          queueWelcomeEmail(uid);
          void registerForPushNotifications(uid).then((r) => {
            if (!r.ok && r.reason !== 'expo_go') {
              logWarn('[push] register on auth change', {
                reason: r.reason,
                detail: r.detail ?? '',
              });
            }
          });
          identify(uid);
        });
        if (event === 'SIGNED_IN') {
          track(EVENTS.AUTH_LOGIN);
          void joinAppPresenceChannel(uid).catch((e) => logWarn('[presence] sign-in join', e));
        }
      } else if (event === 'SIGNED_OUT') {
        setSentryUser(null);
        resetClientModuleStateAtLogout();
        track(EVENTS.AUTH_SIGNOUT);
        resetAnalytics();
        resetLifecycleEmailQueue();
        router.replace('/(auth)/welcome');
      }
    });

    const handleUrl = async ({ url }: { url: string }) => {
      if (!isTrustedInboundUrl(url)) return;

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
                logWarn('[push] register on deep link', {
                  reason: r.reason,
                  detail: r.detail ?? '',
                });
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
      cancelled = true;
      subscription.unsubscribe();
      linkSub.remove();
      appStateSub.remove();
      notifResponseSub.current?.remove();
      notifReceivedSub.current?.remove();
      void leaveAppPresenceChannel().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);
}
