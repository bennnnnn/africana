import React, { useEffect, useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { COLORS } from '@/constants';
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!user) return;

    fetchConversations(user.id);

    channelRef.current = supabase
      .channel(`unread-badge-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new as { sender_id?: string };
        if (message.sender_id === user.id) return;
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => fetchConversations(user.id), 120);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => fetchConversations(user.id), 120);
      })
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchConversations, user?.id]);
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
          tabBarIcon: ({ focused }) => <TabIcon name="heart" focused={focused} />,
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
