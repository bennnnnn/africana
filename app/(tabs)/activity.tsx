import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

type ActivityType = 'like' | 'match' | 'view' | 'message';

interface ActivityFeedRpcRow {
  id: string;
  type: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  preview: string | null;
  createdAt: string;
  navTarget: string;
}

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

const ROW_HEIGHT = 88; // 52 avatar + 14*2 padding + 8 marginBottom

const ActivityRow = memo(function ActivityRow({
  item,
  onPress,
}: {
  item: ActivityItem;
  onPress: (item: ActivityItem) => void;
}) {
  const cfg = TYPE_CONFIG[item.type];
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.85}>
      <View style={{ position: 'relative' }}>
        <Image
          source={{ uri: item.avatar }}
          style={s.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          recyclingKey={item.userId}
        />
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
});

export default function ActivityScreen() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(null);

    try {
      const { data, error } = await supabase.rpc('get_activity_feed');
      if (error) throw error;

      let rows: ActivityFeedRpcRow[] = [];
      const parsed = data as unknown;
      if (Array.isArray(parsed)) {
        rows = parsed as ActivityFeedRpcRow[];
      } else if (typeof parsed === 'string') {
        try {
          const arr = JSON.parse(parsed) as unknown;
          if (Array.isArray(arr)) rows = arr as ActivityFeedRpcRow[];
        } catch {
          /* ignore */
        }
      }

      const isActivityType = (t: string): t is ActivityType =>
        t === 'like' || t === 'match' || t === 'view' || t === 'message';

      const results: ActivityItem[] = [];
      for (const r of rows) {
        if (!isActivityType(r.type)) continue;
        const avatar = avatarFor({
          full_name: r.name,
          avatar_url: r.avatarUrl,
          profile_photos: [],
        });
        results.push({
          id: r.id,
          type: r.type,
          userId: r.userId,
          name: r.name,
          avatar,
          preview: r.preview ?? undefined,
          createdAt: r.createdAt,
          navTarget: r.navTarget,
        });
      }

      setItems(results);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load activity. Pull down to retry.');
    }
  }, [user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Auto-refresh when new likes or profile views arrive
  useEffect(() => {
    if (!user) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void load(), 1500);
    };

    const channel = supabase
      .channel(`activity-realtime-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'likes',
        filter: `to_user_id=eq.${user.id}`,
      }, scheduleReload)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'profile_views',
        filter: `viewed_id=eq.${user.id}`,
      }, scheduleReload)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const activityProfileBrowseIds = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const i of items) {
      if (!i.navTarget.startsWith('/(profile)/')) continue;
      if (seen.has(i.userId)) continue;
      seen.add(i.userId);
      out.push(i.userId);
    }
    return out;
  }, [items]);

  const handlePress = useCallback((item: ActivityItem) => {
    if (item.navTarget.startsWith('/(profile)/')) {
      useProfileBrowseStore.getState().setOrderedUserIds(activityProfileBrowseIds);
      router.push(item.navTarget as any);
      return;
    }
    if (item.type === 'message' && item.navTarget.startsWith('/(chat)/')) {
      const chatId = item.navTarget.slice('/(chat)/'.length);
      router.push({ pathname: '/(chat)/[id]', params: { id: chatId, otherUserId: item.userId } });
      return;
    }
    router.push(item.navTarget as any);
  }, [activityProfileBrowseIds]);

  const renderItem = useCallback(
    ({ item }: { item: ActivityItem }) => <ActivityRow item={item} onPress={handlePress} />,
    [handlePress],
  );
  const keyExtractor = useCallback((item: ActivityItem) => item.id, []);
  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index }),
    [],
  );

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
      {loadError ? (
        <View style={{ margin: 12, padding: 14, backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="alert-circle-outline" size={18} color="#991B1B" />
          <Text style={{ flex: 1, fontSize: 13, color: '#991B1B' }}>{loadError}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
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
