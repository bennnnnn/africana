import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { isProfileCompleteForDiscover, onboardingHrefFromSession } from '@/lib/profile-completion';

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
  const { session, user, isInitialized } = useAuthStore();
  const { conversations, fetchConversations } = useChatStore();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const unseenActivity = useActivityStore(selectLikesTabBadge);
  const setActivityCounts = useActivityStore((s) => s.setCounts);
  const clearActivityCounts = useActivityStore((s) => s.clearAll);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activityChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUnreadMessages(
      conversations.reduce((sum, conversation) => sum + (conversation.unread_count ?? 0), 0)
    );
  }, [conversations]);

  useEffect(() => {
    if (!isInitialized || !session?.user) return;
    if (!isProfileCompleteForDiscover(user)) {
      router.replace(onboardingHrefFromSession(session));
    }
  }, [isInitialized, session, user, router]);

  // Drop browse order when returning to tabs (e.g. back from profile). Clearing on profile
  // blur breaks router.replace between profiles because the screen can unfocus briefly.
  useFocusEffect(
    useCallback(() => {
      useProfileBrowseStore.getState().clearOrderedUserIds();
    }, []),
  );

  useEffect(() => {
    if (!user) return;

    fetchConversations(user.id);

    const scheduleConvRefresh = () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => fetchConversations(user.id), 120);
    };

    channelRef.current = supabase
      .channel(`tab-conversations:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new as { sender_id?: string };
        if (message.sender_id === user.id) return;
        scheduleConvRefresh();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        const ids = (payload.new as { participant_ids?: string[] })?.participant_ids ?? [];
        if (ids.includes(user.id)) scheduleConvRefresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        const ids = (payload.new as { participant_ids?: string[] })?.participant_ids ?? [];
        if (ids.includes(user.id)) scheduleConvRefresh();
      })
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchConversations, user?.id]);

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
      activityRefreshTimeoutRef.current = setTimeout(() => void fetchCounts(), 240);
    };

    activityChannelRef.current = supabase
      .channel(`tab-activity:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        const row = payload.new as { to_user_id?: string };
        if (row.to_user_id === user.id) scheduleRefetch();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favourites' }, (payload) => {
        const row = payload.new as { favourited_id?: string };
        if (row.favourited_id === user.id) scheduleRefetch();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_views' }, (payload) => {
        const row = payload.new as { viewed_id?: string };
        if (row.viewed_id === user.id) scheduleRefetch();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_settings' }, (payload) => {
        // Marking tabs as seen inside the Likes screen updates `*_seen_at`
        // on user_settings. Re-fetch so the badge clears in the bottom bar.
        const row = payload.new as { user_id?: string };
        if (row.user_id === user.id) scheduleRefetch();
      })
      .subscribe();

    return () => {
      if (activityRefreshTimeoutRef.current) clearTimeout(activityRefreshTimeoutRef.current);
      if (activityChannelRef.current) supabase.removeChannel(activityChannelRef.current);
    };
  }, [user?.id, setActivityCounts, clearActivityCounts]);
  // On Android with edgeToEdgeEnabled, insets.bottom is the system nav bar height
  const tabBarHeight = 56 + insets.bottom;
  const tabBarPaddingBottom = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 20 : 8);

  return (
    <Tabs
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
          tabBarIcon: ({ focused }) => <TabIcon name="chatbubbles" focused={focused} badge={unreadMessages} />,
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
