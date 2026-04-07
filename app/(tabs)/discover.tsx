import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, Pressable,
  ActivityIndicator, RefreshControl, Animated, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useChatStore } from '@/store/chat.store';
import { UserCard } from '@/components/discover/UserCard';
import { FilterSheet } from '@/components/discover/FilterSheet';
import { MatchModal } from '@/components/ui/MatchModal';
import { COLORS } from '@/constants';
import { User } from '@/types';

const REPORT_REASONS = ['Fake profile', 'Scam', 'Harassment', 'Nudity', 'Underage', 'Other'] as const;

export default function DiscoverScreen() {
  const { user } = useAuthStore();
  const { users, isLoading, hasMore, filters, fetchUsers, fetchLikedUserIds, toggleLike, likedUserIds, setFilters, resetFilters, subscribeToOnlineStatus, unsubscribeFromOnlineStatus } =
    useDiscoverStore();
  const { getOrCreateConversation } = useChatStore();
  const [showFilters, setShowFilters]   = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [matchUser, setMatchUser]       = useState<User | null>(null);
  const [optionsUser, setOptionsUser]   = useState<User | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<typeof REPORT_REASONS[number] | null>(null);
  const [localBlocked, setLocalBlocked] = useState<Set<string>>(new Set());

  // Toast
  const toastAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState<{ icon: string; msg: string } | null>(null);
  const showToast = (icon: string, msg: string) => {
    setToast({ icon, msg });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  // Fade-in animation for the header greeting
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUsers(user.id, user.interested_in, true);
      fetchLikedUserIds(user.id);
      subscribeToOnlineStatus();
    }
    return () => {
      unsubscribeFromOnlineStatus();
    };
  }, [user?.id]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchUsers(user.id, user.interested_in, true);
    setRefreshing(false);
  }, [user]);

  const handleLoadMore = () => {
    if (!isLoading && hasMore && user) {
      fetchUsers(user.id, user.interested_in);
    }
  };

  const handleMessage = async (toUserId: string) => {
    if (!user) return;
    const convId = await getOrCreateConversation(user.id, toUserId);
    if (convId) router.push(`/(chat)/${convId}`);
  };

  const handleBlock = () => {
    if (!user || !optionsUser) return;
    const name = optionsUser.full_name;
    const blockedId = optionsUser.id;
    setOptionsUser(null); // close sheet first
    setTimeout(() => {
      Alert.alert(
        `Block ${name}?`,
        "They won't appear in Discover and won't be able to contact you.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: blockedId });
              setLocalBlocked((prev) => new Set([...prev, blockedId]));
              showToast('🚫', `${name} blocked`);
            },
          },
        ]
      );
    }, 300);
  };

  const handleReport = () => {
    setOptionsUser(null);
    setSelectedReason(null);
    setTimeout(() => setReportVisible(true), 150);
  };

  const submitReport = async () => {
    if (!user || !optionsUser || !selectedReason) return;
    await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_id: optionsUser.id,
      reason: selectedReason,
    });
    setReportVisible(false);
    setSelectedReason(null);
    showToast('🚩', 'Report submitted');
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'min_age') return v !== 18;
    if (k === 'max_age') return v !== 100;
    if (k === 'online_only') return v === true;
    return v !== null;
  }).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: '#FFFFFF',
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        }}
      >
        <View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>
            Discover
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 1 }}>
            {user ? `Hey ${user.full_name?.split(' ')[0] ?? ''} 👋  ` : ''}
            {users.length > 0 ? `${users.length} members` : 'Find your connection'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: activeFilterCount > 0 ? `${COLORS.primary}15` : COLORS.savanna,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: activeFilterCount > 0 ? 1.5 : 0,
            borderColor: COLORS.primary,
          }}
        >
          <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? COLORS.primary : COLORS.earth} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: activeFilterCount > 0 ? COLORS.primary : COLORS.earth }}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </Animated.View>

        <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        overScrollMode="always"
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        renderItem={({ item }) => (
          localBlocked.has(item.id) ? null : (
          <UserCard
            user={item}
            isLiked={likedUserIds.has(item.id)}
            onLike={async (id) => {
              if (!user) return;
              const wasLiked = likedUserIds.has(id);
              const isMatch = await toggleLike(user.id, id);
              if (isMatch && !wasLiked) {
                setMatchUser(users.find((u) => u.id === id) ?? null);
                showToast('🔥', 'It’s a match!');
              } else {
                showToast(wasLiked ? '💔' : '❤️', wasLiked ? 'Unliked' : 'Liked!');
              }
            }}
            onMessage={handleMessage}
            onOptions={(id) => setOptionsUser(users.find((u) => u.id === id) ?? null)}
          />
          )
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 }}>
              <Text style={{ fontSize: 48 }}>🌍</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' }}>
                No members found
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                Try widening your filters — age range, location, or religion — and more Africana members will appear.
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  onPress={() => { resetFilters(); if (user) fetchUsers(user.id, user.interested_in, true); }}
                  style={{ marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
      />

      <FilterSheet
        visible={showFilters}
        filters={filters}
        onClose={() => setShowFilters(false)}
        onApply={(f) => {
          setFilters(f);
          if (user) fetchUsers(user.id, user.interested_in, true);
        }}
        onReset={() => {
          resetFilters();
          if (user) fetchUsers(user.id, user.interested_in, true);
        }}
      />

      <MatchModal visible={!!matchUser} matchedUser={matchUser} onClose={() => setMatchUser(null)} />

      {/* Toast */}
      {toast && (
        <Animated.View pointerEvents="none" style={[
          s.toast,
          { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
        ]}>
          <Text style={{ fontSize: 18 }}>{toast.icon}</Text>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{toast.msg}</Text>
        </Animated.View>
      )}

      {/* Options sheet (block / report) */}
      <Modal visible={!!optionsUser} transparent animationType="slide" onRequestClose={() => setOptionsUser(null)}>
        <Pressable style={s.backdrop} onPress={() => setOptionsUser(null)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{optionsUser?.full_name}</Text>
          <TouchableOpacity style={s.sheetItem} onPress={handleReport}>
            <View style={[s.sheetIcon, { backgroundColor: '#FFF7E8' }]}>
              <Ionicons name="flag-outline" size={18} color="#A06A00" />
            </View>
            <Text style={s.sheetLabel}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.sheetItem} onPress={handleBlock}>
            <View style={[s.sheetIcon, { backgroundColor: '#FFF0F0' }]}>
              <Ionicons name="ban-outline" size={18} color="#E53E3E" />
            </View>
            <Text style={[s.sheetLabel, { color: '#E53E3E' }]}>Block</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.sheetItem, { marginTop: 4 }]} onPress={() => setOptionsUser(null)}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center', flex: 1 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Report reason modal */}
      <Modal visible={reportVisible} transparent animationType="fade"
        onRequestClose={() => { setReportVisible(false); setSelectedReason(null); }}>
        <View style={s.reportOverlay}>
          <View style={s.reportCard}>
            <Text style={s.reportTitle}>Report {optionsUser?.full_name}</Text>
            <Text style={{ fontSize: 13, color: '#555', marginTop: 4, marginBottom: 14 }}>Select a reason</Text>
            <View style={{ gap: 8 }}>
              {REPORT_REASONS.map((r) => {
                const on = selectedReason === r;
                return (
                  <TouchableOpacity key={r} onPress={() => setSelectedReason(r)}
                    style={[s.reasonOption, on && s.reasonOptionOn]}>
                    <Text style={[s.reasonTxt, on && { color: COLORS.primary, fontWeight: '700' }]}>{r}</Text>
                    {on && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              <TouchableOpacity style={s.reportCancel} onPress={() => { setReportVisible(false); setSelectedReason(null); }}>
                <Text style={{ fontWeight: '700', color: '#111', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.reportSubmit, !selectedReason && { opacity: 0.4 }]}
                onPress={submitReport} disabled={!selectedReason}>
                <Text style={{ fontWeight: '700', color: '#FFF', fontSize: 15 }}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  toast:        { position: 'absolute', top: 90, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(17,17,17,0.88)', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 30 },
  backdrop:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, paddingTop: 8, paddingHorizontal: 20 },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 14 },
  sheetItem:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sheetIcon:    { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetLabel:   { fontSize: 16, fontWeight: '600', color: '#111' },
  reportOverlay:{ flex: 1, backgroundColor: 'rgba(17,17,17,0.36)', justifyContent: 'center', padding: 24 },
  reportCard:   { backgroundColor: '#FFF', borderRadius: 24, padding: 22 },
  reportTitle:  { fontSize: 20, fontWeight: '800', color: '#111' },
  reasonOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#E7E1DC', backgroundColor: '#FFF' },
  reasonOptionOn:{ borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}08` },
  reasonTxt:    { fontSize: 14, fontWeight: '500', color: '#111' },
  reportCancel: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E7E1DC', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  reportSubmit: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
});
