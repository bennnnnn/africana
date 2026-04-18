import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/theme/ThemeProvider';
import { isUserEffectivelyOnline } from '@/lib/utils';
import { DEFAULT_AVATAR } from '@/constants';
import { User } from '@/types';
import { filterVisibleUserEntities } from '@/lib/social-visibility';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { setProfileSeed } from '@/lib/profile-seed-cache';

interface ViewerRow {
  id: string;
  viewed_at: string;
  viewer: User;
}

const ROW_HEIGHT = 83; // 54 avatar + 14*2 padding + 1 border

const ViewerRowItem = memo(function ViewerRowItem({
  item,
  cardBg,
  surfaceBg,
  textColor,
  textSecondary,
  textMuted,
  borderColor,
  primaryColor,
  onOpen,
}: {
  item: ViewerRow;
  cardBg: string;
  surfaceBg: string;
  textColor: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  primaryColor: string;
  onOpen: (v: User) => void;
}) {
  const v = item.viewer;
  const avatar = v.avatar_url || (v.profile_photos ?? [])[0] || `${DEFAULT_AVATAR}${encodeURIComponent((v.full_name ?? '?').charAt(0))}`;
  const location = [v.city, v.country].filter(Boolean).join(', ');
  return (
    <TouchableOpacity
      onPress={() => onOpen(v)}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: borderColor,
        backgroundColor: cardBg,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Image
          source={{ uri: avatar }}
          style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: surfaceBg }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          recyclingKey={v.id}
        />
        {isUserEffectivelyOnline(v.online_status, v.last_seen) && (
          <View style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: '#22C55E',
            borderWidth: 2, borderColor: cardBg,
          }} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>{v.full_name}</Text>
          {(v.verified || v.verification_status === 'approved') && (
            <Ionicons name="checkmark-circle" size={15} color={primaryColor} />
          )}
        </View>
        {location ? (
          <Text style={{ fontSize: 12, color: textSecondary, marginTop: 1 }}>{location}</Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 12, color: textMuted }}>{timeAgo(item.viewed_at)}</Text>
      <Ionicons name="chevron-forward" size={16} color={textMuted} />
    </TouchableOpacity>
  );
});

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ViewersScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const [viewers, setViewers] = useState<ViewerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchViewers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profile_views')
      .select('id, viewed_at, viewer:profiles!viewer_id(*)')
      .eq('viewed_id', user.id)
      .order('viewed_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      const rows = data
        .filter((row: any) => row.viewer)
        .map((row: any) => ({ id: row.id, viewed_at: row.viewed_at, viewer: row.viewer as User }));
      const visibleViewers = await filterVisibleUserEntities(
        user.id,
        rows.map((row) => row.viewer),
      );
      const visibleViewerIds = new Set(visibleViewers.map((viewer) => viewer.id));
      setViewers(
        rows.filter((row) => visibleViewerIds.has(row.viewer.id))
      );
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchViewers().finally(() => setLoading(false));
  }, [fetchViewers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchViewers();
    setRefreshing(false);
  };

  const viewerBrowseIds = useMemo(() => viewers.map((r) => r.viewer.id), [viewers]);

  const handleOpen = useCallback((v: User) => {
    setProfileSeed(v);
    useProfileBrowseStore.getState().setOrderedUserIds(viewerBrowseIds);
    router.push(`/(profile)/${v.id}`);
  }, [viewerBrowseIds]);

  const renderItem = useCallback(
    ({ item }: { item: ViewerRow }) => (
      <ViewerRowItem
        item={item}
        cardBg={colors.card}
        surfaceBg={colors.surface}
        textColor={colors.text}
        textSecondary={colors.textSecondary}
        textMuted={colors.textMuted}
        borderColor={colors.border}
        primaryColor={colors.primary}
        onOpen={handleOpen}
      />
    ),
    [handleOpen, colors],
  );
  const keyExtractor = useCallback((item: ViewerRow) => item.id, []);
  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index }),
    [],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 14,
        backgroundColor: colors.card,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Who Viewed Me</Text>
        {viewers.length > 0 && (
          <View style={{ marginLeft: 'auto', backgroundColor: `${colors.primary}18`, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>{viewers.length}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={viewers}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          contentContainerStyle={viewers.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 }}>
              <Ionicons name="eye-off-outline" size={52} color={colors.textMuted} />
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>No views yet</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 }}>
                When someone visits your profile, they'll appear here. Complete your profile to get more visibility.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
