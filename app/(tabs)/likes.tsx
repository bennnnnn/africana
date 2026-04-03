import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { User } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { MOCK_USERS } from '@/lib/mock-data';
import { EmptyState } from '@/components/ui/EmptyState';

type Tab = 'received' | 'sent';

export default function LikesScreen() {
  const { user } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();
  const [tab, setTab] = useState<Tab>('received');
  const [receivedLikes, setReceivedLikes] = useState<User[]>([]);
  const [sentLikes, setSentLikes] = useState<User[]>([]);
  const [matches, setMatches] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLikes = useCallback(async () => {
    if (!user) return;

    const [{ data: received }, { data: sent }] = await Promise.all([
      supabase
        .from('likes')
        .select('from_user:profiles!from_user_id(*)')
        .eq('to_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('likes')
        .select('to_user:profiles!to_user_id(*)')
        .eq('from_user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    const receivedList: User[] = received
      ? received.map((r: any) => r.from_user as User).filter(Boolean)
      : [];
    const sentList: User[] = sent
      ? sent.map((s: any) => s.to_user as User).filter(Boolean)
      : [];

    const sentIds = new Set(sentList.map((u) => u.id));
    const mutualMatches = receivedList.filter((u) => sentIds.has(u.id));

    setReceivedLikes(receivedList.length > 0 ? receivedList : __DEV__ ? MOCK_USERS.slice(0, 5) : []);
    setSentLikes(sentList.length > 0 ? sentList : __DEV__ ? MOCK_USERS.slice(4, 7) : []);
    setMatches(mutualMatches.length > 0 ? mutualMatches : __DEV__ ? MOCK_USERS.slice(0, 3) : []);
  }, [user]);

  useEffect(() => { fetchLikes().finally(() => setIsLoading(false)); }, [fetchLikes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLikes();
    setRefreshing(false);
  };

  const handleMessage = async (toUserId: string) => {
    if (!user) return;
    const convId = await getOrCreateConversation(user.id, toUserId);
    if (convId) router.push(`/(chat)/${convId}`);
  };

  const list = tab === 'received' ? receivedLikes : sentLikes;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>Likes</Text>
        <View style={s.tabs}>
          {(['received', 'sent'] as Tab[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]}>
              <Text style={[s.tabText, tab === t && s.tabTextOn]}>
                {t === 'received' ? '❤️ Received' : '💌 Sent'}
              </Text>
              <View style={[s.tabBadge, tab === t && s.tabBadgeOn]}>
                <Text style={[s.tabBadgeText, tab === t && s.tabBadgeTextOn]}>
                  {t === 'received' ? receivedLikes.length : sentLikes.length}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }

        ListHeaderComponent={
          matches.length > 0 ? (
            <View style={s.matchesSection}>
              <View style={s.matchesHeaderRow}>
                <Text style={s.matchesTitle}>🔥 Matches</Text>
                <Text style={s.matchesCount}>{matches.length} mutual</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingHorizontal: 2, paddingBottom: 2 }}
              >
                {matches.map((m) => {
                  const avatar = m.avatar_url || (m.profile_photos ?? [])[0]
                    || `${DEFAULT_AVATAR}${encodeURIComponent((m.full_name ?? '?').charAt(0))}`;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => router.push(`/(profile)/${m.id}`)}
                      style={s.matchItem}
                      activeOpacity={0.85}
                    >
                      <View style={s.matchRing}>
                        <Image source={{ uri: avatar }} style={s.matchImg} contentFit="cover" />
                      </View>
                      {/* Quick message button */}
                      <TouchableOpacity onPress={() => handleMessage(m.id)} style={s.matchMsgBtn}>
                        <Ionicons name="chatbubble" size={10} color="#FFF" />
                      </TouchableOpacity>
                      <Text style={s.matchName} numberOfLines={1}>
                        {m.full_name?.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null
        }

        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title={tab === 'received' ? 'No likes yet' : "You haven't liked anyone yet"}
            description={
              tab === 'received'
                ? 'Complete your profile to attract more attention.'
                : 'Browse Discover to find someone you like.'
            }
          />
        }

        renderItem={({ item }) => {
          const avatar = item.avatar_url || (item.profile_photos ?? [])[0]
            || `${DEFAULT_AVATAR}${encodeURIComponent((item.full_name ?? '?').charAt(0))}`;
          const today = new Date();
          const bday = item.birthdate ? new Date(item.birthdate) : null;
          const age = bday
            ? today.getFullYear() - bday.getFullYear()
              - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
            : null;
          const location = [item.city, item.country].filter(Boolean).join(', ');
          const isOnline = item.online_status === 'online';
          const isMutual = matches.some((m) => m.id === item.id);

          return (
            <TouchableOpacity
              onPress={() => router.push(`/(profile)/${item.id}`)}
              style={s.row}
              activeOpacity={0.82}
            >
              {/* Avatar */}
              <View style={s.avatarWrap}>
                <Image source={{ uri: avatar }} style={s.avatar} contentFit="cover" />
                <View style={[s.onlineDot, { backgroundColor: isOnline ? COLORS.online : COLORS.offline }]} />
              </View>

              {/* Name + location */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.rowName} numberOfLines={1}>
                    {item.full_name}{age ? `, ${age}` : ''}
                  </Text>
                  {isMutual && (
                    <View style={s.mutualBadge}>
                      <Text style={{ fontSize: 10 }}>🔥</Text>
                    </View>
                  )}
                </View>
                {location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
                    <Text style={s.rowLocation} numberOfLines={1}>{location}</Text>
                  </View>
                ) : null}
              </View>

              {/* Message shortcut */}
              <TouchableOpacity
                onPress={() => handleMessage(item.id)}
                style={s.msgBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>

              {/* Chevron */}
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          );
        }}

        ItemSeparatorComponent={() => <View style={s.separator} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 0,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabOn: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: COLORS.textSecondary },
  tabTextOn: { color: COLORS.primary, fontWeight: '700' },
  tabBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  tabBadgeOn: { backgroundColor: COLORS.primary },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  tabBadgeTextOn: { color: '#FFF' },

  /* Matches strip */
  matchesSection: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  matchesHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  matchesTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  matchesCount: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  matchItem: { alignItems: 'center', width: 64 },
  matchRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2.5, borderColor: COLORS.primary,
    padding: 2, position: 'relative',
  },
  matchImg: { width: '100%', height: '100%', borderRadius: 24 },
  matchMsgBtn: {
    position: 'absolute', bottom: 14, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },
  matchName: {
    fontSize: 11, fontWeight: '600', color: COLORS.text,
    marginTop: 5, textAlign: 'center',
  },

  /* List rows */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    gap: 12,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 76, // align with text, past avatar
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
  },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 2, borderColor: '#FFF',
  },
  rowName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  rowLocation: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  mutualBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, backgroundColor: `${COLORS.primary}15`,
  },
  msgBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
});
