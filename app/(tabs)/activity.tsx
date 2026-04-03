import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

type ActivityType = 'like' | 'match' | 'view' | 'message';

interface ActivityItem {
  id: string;
  type: ActivityType;
  userId: string;
  name: string;
  avatar: string;
  preview?: string;
  createdAt: string;
  navTarget: string;
}

const TYPE_CONFIG: Record<ActivityType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  like:    { icon: 'heart',      color: '#EF4444',      label: 'liked your profile' },
  match:   { icon: 'flame',      color: COLORS.primary, label: 'matched with you 🔥' },
  view:    { icon: 'eye',        color: COLORS.earth,   label: 'viewed your profile' },
  message: { icon: 'chatbubble', color: '#3B82F6',      label: 'sent you a message' },
};

function avatarFor(p: any): string {
  return p?.avatar_url
    || p?.profile_photos?.[0]
    || `${DEFAULT_AVATAR}${encodeURIComponent((p?.full_name ?? '?').charAt(0))}`;
}

export default function ActivityScreen() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const userId = user.id;
    const results: ActivityItem[] = [];

    try {
      // ── 1. Likes received — simple query, no join ────────────────────────────
      const { data: likes } = await supabase
        .from('likes')
        .select('id, created_at, from_user_id')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      // ── 2. IDs of people I liked (to detect matches) ─────────────────────────
      const { data: myLikes } = await supabase
        .from('likes')
        .select('to_user_id')
        .eq('from_user_id', userId);
      const myLikedIds = new Set((myLikes ?? []).map((l: any) => l.to_user_id));

      // ── 3. Fetch profiles for like senders ───────────────────────────────────
      const likerIds = [...new Set((likes ?? []).map((l: any) => l.from_user_id))];
      let likerProfiles: Record<string, any> = {};
      if (likerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, profile_photos')
          .in('id', likerIds);
        (profiles ?? []).forEach((p: any) => { likerProfiles[p.id] = p; });
      }

      for (const like of likes ?? []) {
        const p = likerProfiles[like.from_user_id];
        if (!p) continue;
        const isMatch = myLikedIds.has(like.from_user_id);
        results.push({
          id: `like-${like.id}`,
          type: isMatch ? 'match' : 'like',
          userId: p.id,
          name: p.full_name,
          avatar: avatarFor(p),
          createdAt: like.created_at,
          navTarget: `/(profile)/${p.id}`,
        });
      }

      // ── 4. Profile views — simple query, no join ─────────────────────────────
      const { data: views } = await supabase
        .from('profile_views')
        .select('id, viewed_at, viewer_id')
        .eq('viewed_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(20);

      const viewerIds = [...new Set((views ?? []).map((v: any) => v.viewer_id))];
      let viewerProfiles: Record<string, any> = {};
      if (viewerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, profile_photos')
          .in('id', viewerIds);
        (profiles ?? []).forEach((p: any) => { viewerProfiles[p.id] = p; });
      }

      const matchedIds = new Set(results.filter((r) => r.type === 'match').map((r) => r.userId));
      for (const view of views ?? []) {
        const p = viewerProfiles[view.viewer_id];
        if (!p || matchedIds.has(p.id)) continue;
        results.push({
          id: `view-${view.id}`,
          type: 'view',
          userId: p.id,
          name: p.full_name,
          avatar: avatarFor(p),
          createdAt: view.viewed_at,
          navTarget: `/(profile)/${p.id}`,
        });
      }

      // ── 5. Recent conversations ──────────────────────────────────────────────
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, last_message, last_message_at, participant_ids')
        .contains('participant_ids', [userId])
        .not('last_message', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(10);

      for (const conv of convs ?? []) {
        const otherId = (conv.participant_ids as string[]).find((id) => id !== userId);
        if (!otherId) continue;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, profile_photos')
          .eq('id', otherId)
          .single();
        if (!profile) continue;
        results.push({
          id: `msg-${conv.id}`,
          type: 'message',
          userId: profile.id,
          name: profile.full_name,
          avatar: avatarFor(profile),
          preview: conv.last_message ?? '',
          createdAt: conv.last_message_at ?? new Date().toISOString(),
          navTarget: `/(chat)/${conv.id}`,
        });
      }
    } catch (err) {
      console.warn('Activity load error:', err);
    }

    // Sort by time desc, deduplicate by userId+type
    const seen = new Set<string>();
    const unique = results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((item) => {
        const key = `${item.type}-${item.userId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    setItems(unique);
  }, [user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View style={s.header}>
        <Text style={s.title}>Activity</Text>
        <Text style={s.subtitle}>
          {items.length > 0 ? `${items.length} recent actions` : 'Your activity will appear here'}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <Ionicons name="notifications-outline" size={52} color={COLORS.border} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>Nothing yet</Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              When someone likes or views your profile,{'\n'}it will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = TYPE_CONFIG[item.type];
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push(item.navTarget as any)}
              activeOpacity={0.85}
            >
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: item.avatar }} style={s.avatar} contentFit="cover" />
                <View style={[s.typeBadge, { backgroundColor: cfg.color }]}>
                  <Ionicons name={cfg.icon} size={11} color="#FFF" />
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={[s.action, { color: cfg.color }]}>{cfg.label}</Text>
                {item.preview ? (
                  <Text style={s.preview} numberOfLines={1}>{item.preview}</Text>
                ) : null}
              </View>

              <Text style={s.time}>{dayjs(item.createdAt).fromNow(true)}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title:    { fontSize: 24, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  name:    { fontSize: 15, fontWeight: '700', color: COLORS.text },
  action:  { fontSize: 13, fontWeight: '500', marginTop: 2 },
  preview: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  time:    { fontSize: 11, color: COLORS.textMuted },
});
