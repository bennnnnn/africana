import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFocusEffect } from '@react-navigation/native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { COLORS } from '@/constants';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { useActivityStore, selectLikesTabBadge } from '@/store/activity.store';
import { isProfileCompleteForDiscover, postAuthHref } from '@/lib/profile-completion';
import haptics from '@/lib/haptics';
import { isViewingConversation } from '@/lib/active-chat';
import { allowIncomingMessageNotificationCue, sendLocalNotification } from '@/lib/notifications';
import { TIMINGS } from '@/lib/timings';

/**
 * Supabase reuses `client.channel(topic)` if that topic still exists. `removeChannel`
 * is async, so remounting tabs can recreate `...:1` while the old channel is still
 * in the client → first `.on()` throws "after subscribe". UUID avoids collisions.
 */
function realtimeUniqueSuffix(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function TabIcon({
  name,
  focused,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={{ position: 'relative' }}>
      <Ionicons
        name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)}
        size={24}
        color={focused ? COLORS.primary : COLORS.textSecondary}
      />
      {badge && badge > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            backgroundColor: COLORS.primary,
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '700' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, user, isInitialized, isLoading } = useAuthStore(
    useShallow((s) => ({
      session: s.session,
      user: s.user,
      isInitialized: s.isInitialized,
      isLoading: s.isLoading,
    })),
  );
  const { conversations } = useChatStore(
    useShallow((s) => ({
      conversations: s.conversations,
    })),
  );
  const [unreadMessages, setUnreadMessages] = useState(0);
  const unseenActivity = useActivityStore(selectLikesTabBadge);
  const setActivityCounts = useActivityStore((s) => s.setCounts);
  const bumpIncoming = useActivityStore((s) => s.bumpIncoming);
  const clearActivityCounts = useActivityStore((s) => s.clearAll);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activityChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUnreadMessages(
      conversations.reduce((sum, conversation) => sum + (conversation.unread_count ?? 0), 0),
    );
  }, [conversations]);

  useEffect(() => {
    if (!isInitialized || isLoading || !session?.user) return;
    if (!isProfileCompleteForDiscover(user)) {
      router.replace(postAuthHref(user, session));
    }
  }, [isInitialized, isLoading, session, user, router]);

  // Drop browse order when returning to tabs (e.g. back from profile). Clearing on profile
  // blur breaks router.replace between profiles because the screen can unfocus briefly.
  useFocusEffect(
    useCallback(() => {
      useProfileBrowseStore.getState().clearOrderedUserIds();
    }, []),
  );

  useEffect(() => {
    if (!user) return;

    const uid = user.id;

    // Initial inbox load.
    useChatStore.getState().fetchConversations(uid);

    const scheduleConvRefresh = () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      // Use store getState() to avoid any stale closure issues.
      refreshTimeoutRef.current = setTimeout(
        () => useChatStore.getState().fetchConversations(uid, { force: true }),
        TIMINGS.realtimeRefreshDebounceMs,
      );
    };

    const ch = supabase.channel(`tab-conversations:${uid}:${realtimeUniqueSuffix()}`);
    channelRef.current = ch;

    ch.on(
      'postgres_changes',
      // Filter server-side to messages not sent by this user. Postgres realtime
      // doesn't support array-contains on participant_ids, so we filter on
      // sender_id and do a client-side conversation membership check. This still
      // receives messages to any conversation this user is not in if the sender
      // happens not to be them — those are dropped immediately below.
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=neq.${uid}` },
      (payload) => {
        const message = payload.new as {
          sender_id?: string;
          conversation_id?: string;
          content?: string;
        };
        // Drop messages from conversations this user is not in.
        const knownConvIds = new Set(useChatStore.getState().conversations.map((c) => c.id));
        if (message.conversation_id && !knownConvIds.has(message.conversation_id)) return;
        scheduleConvRefresh();
        // Foreground ping rationale: see docs/foreground-notifications.md
        if (isViewingConversation(message.conversation_id)) return;
        if (!allowIncomingMessageNotificationCue(useAuthStore.getState().settings)) return;
        haptics.tapMedium();
        // Pull the sender name from the chat store directly via getState() so
        // we don't have to add `conversations` to the effect deps (which would
        // tear down + rebuild this realtime channel on every list mutation).
        const senderName =
          useChatStore.getState().conversations.find((c) => c.id === message.conversation_id)
            ?.other_user?.full_name ?? 'Someone';
        const preview = (message.content ?? '').trim();
        void sendLocalNotification(
          `💬 ${senderName}`,
          preview
            ? preview.length > 100
              ? `${preview.slice(0, 97)}…`
              : preview
            : 'sent you a message',
          'message',
          message.conversation_id ? { conversationId: message.conversation_id } : undefined,
        );
      },
    )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const ids = (payload.new as { participant_ids?: string[] })?.participant_ids ?? [];
          if (ids.includes(uid)) scheduleConvRefresh();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const ids = (payload.new as { participant_ids?: string[] })?.participant_ids ?? [];
          if (ids.includes(uid)) scheduleConvRefresh();
        },
      )
      .subscribe((status) => {
        // In dev / Expo Go, the realtime websocket can silently time out.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          scheduleConvRefresh();
        }
      });

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      const toRemove = channelRef.current;
      channelRef.current = null;
      if (toRemove) void supabase.removeChannel(toRemove);
    };
  }, [user?.id]);

  // Activity badge for the Likes tab — aggregates unseen likes / matches /
  // views / stars so the user sees a red dot on the heart icon the moment
  // anyone interacts with them. Fetches via RPC on mount + debounced refetch
  // whenever a realtime INSERT fires on the relevant tables.
  useEffect(() => {
    if (!user) {
      clearActivityCounts();
      return;
    }

    const fetchCounts = async () => {
      const { data, error } = await supabase.rpc('activity_unseen_counts');
      if (error || data == null) return;
      const d = data as Record<string, unknown>;
      setActivityCounts({
        matches: Number(d.matches) || 0,
        received: Number(d.received) || 0,
        viewers: Number(d.viewers) || 0,
        favourites: Number(d.favourites) || 0,
      });
    };

    void fetchCounts();

    const scheduleRefetch = () => {
      if (activityRefreshTimeoutRef.current) clearTimeout(activityRefreshTimeoutRef.current);
      // Notify the Likes hub (via shared store) that new activity arrived so it
      // can reload the active tab without maintaining its own duplicate channel.
      bumpIncoming();
      activityRefreshTimeoutRef.current = setTimeout(
        () => void fetchCounts(),
        TIMINGS.activityCountDebounceMs,
      );
    };

    const aid = user.id;
    const ach = supabase.channel(`tab-activity:${aid}:${realtimeUniqueSuffix()}`);
    activityChannelRef.current = ach;

    ach
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
          filter: `to_user_id=eq.${aid}`,
        },
        () => scheduleRefetch(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'favourites',
          filter: `favourited_id=eq.${aid}`,
        },
        () => scheduleRefetch(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profile_views',
          filter: `viewed_id=eq.${aid}`,
        },
        () => scheduleRefetch(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${aid}`,
        },
        () => scheduleRefetch(),
      )
      .subscribe();

    return () => {
      if (activityRefreshTimeoutRef.current) clearTimeout(activityRefreshTimeoutRef.current);
      const toRemove = activityChannelRef.current;
      activityChannelRef.current = null;
      if (toRemove) void supabase.removeChannel(toRemove);
    };
  }, [user?.id]);
  // On Android with edgeToEdgeEnabled, insets.bottom is the system nav bar height
  const tabBarHeight = 56 + insets.bottom;
  const tabBarPaddingBottom = insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 20 : 8;

  return (
    <Tabs
      screenListeners={{
        // Same gentle thump as the segmented tabs in Likes — fires on every
        // bottom-bar press, including re-tap of the active tab. Cheap and
        // makes the whole app feel a touch more responsive.
        tabPress: () => haptics.tapLight(),
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => <TabIcon name="compass" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: 'Likes',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="heart" focused={focused} badge={unseenActivity} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="chatbubbles" focused={focused} badge={unreadMessages} />
          ),
        }}
      />
      {/* Activity tab — hidden until launch */}
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
      {/* Hidden tabs */}
      <Tabs.Screen name="online" options={{ href: null }} />
    </Tabs>
  );
}
