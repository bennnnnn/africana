import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Modal, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User } from '@/types';
import { COLORS, RADIUS, FONT, SHADOWS } from '@/constants';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { setProfileSeed } from '@/lib/profile-seed-cache';
import { getEffectivePresence, formatLastSeen } from '@/lib/utils';
import { profileImageUrlForList } from '@/lib/storage-image-url';
import { usePresenceStore } from '@/store/presence.store';
import { useAuthStore } from '@/store/auth.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { UI_TOAST } from '@/constants/copy';
import haptics from '@/lib/haptics';

// ─── Floating action circle — identical to profile screen ────────────────────
const FLOAT_SIZE = 56;
const floatCircle = {
  width: FLOAT_SIZE,
  height: FLOAT_SIZE,
  borderRadius: FLOAT_SIZE / 2,
  backgroundColor: COLORS.white,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  ...SHADOWS.lg,
};

// ─── Card content ────────────────────────────────────────────────────────────
function CardContent({
  user,
  cardWidth,
  cardHeight,
}: {
  user: User;
  cardWidth: number;
  cardHeight: number;
}) {
  const photos = useMemo(() => {
    const p = user.profile_photos ?? [];
    return p.length > 0 ? p : user.avatar_url ? [user.avatar_url] : [];
  }, [user]);
  const rawHero = photos[0] ?? null;
  const optimizedHero = useMemo(
    () => (rawHero ? (profileImageUrlForList(rawHero) ?? rawHero) : null),
    [rawHero],
  );
  const [heroUri, setHeroUri] = useState<string | null>(optimizedHero);
  useEffect(() => {
    setHeroUri(optimizedHero);
  }, [optimizedHero, user.id]);

  const peerOnlineIds = usePresenceStore((s) => s.peerOnlineIds);
  const isOnline =
    getEffectivePresence(
      {
        id: user.id,
        online_visible: user.online_visible,
        online_status: user.online_status,
        last_seen: user.last_seen,
      },
      peerOnlineIds,
    ) === 'online';
  const location = [user.city, user.state, user.country].filter(Boolean).join(', ');
  const activityLabel = isOnline
    ? 'Online'
    : user.online_visible === false
      ? 'Offline'
      : (formatLastSeen(user.last_seen) ?? 'Offline');

  return (
    <View
      style={{
        width: cardWidth,
        height: cardHeight,
        borderRadius: RADIUS.xxl,
        overflow: 'hidden',
        backgroundColor: COLORS.savanna,
      }}
    >
      {heroUri ? (
        <Image
          source={{ uri: heroUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={`${user.id}:${rawHero ?? ''}`}
          onError={() => {
            if (rawHero != null && heroUri !== rawHero) setHeroUri(rawHero);
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.savanna }]} />
      )}

      {photos.length > 1 && (
        <View style={cc.dotsRow}>
          {photos.slice(0, 5).map((_, i) => (
            <View key={i} style={[cc.dot, i === 0 && cc.dotActive]} />
          ))}
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.5, 1]}
        style={cc.overlay}
      >
        <View style={cc.nameRow}>
          <Text style={cc.name} numberOfLines={1}>
            {user.full_name}
            {user.age ? `, ${user.age}` : ''}
          </Text>
          {user.verified && <VerifiedBadge size={15} />}
        </View>
        <View style={cc.metaRow}>
          <View style={[cc.onlineDot, isOnline && cc.onlineDotActive]} />
          <Text style={[cc.metaText, isOnline && cc.metaTextOnline]} numberOfLines={1}>
            {activityLabel}
            {location ? `  ·  ${location}` : ''}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const cc = StyleSheet.create({
  dotsRow: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: COLORS.white,
    width: 20,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 18,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  onlineDotActive: {
    backgroundColor: COLORS.green,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
  },
  metaTextOnline: {
    color: COLORS.green,
  },
});

// ─── Main modal ──────────────────────────────────────────────────────────────

interface QuickPreviewModalProps {
  visible: boolean;
  users: User[];
  startIndex: number;
  onClose: () => void;
}

export function QuickPreviewModal({ visible, users, startIndex, onClose }: QuickPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const currentUser = useAuthStore((s) => s.user);
  const { likedUserIds, toggleLike } = useDiscoverStore(
    useShallow((s) => ({ likedUserIds: s.likedUserIds, toggleLike: s.toggleLike })),
  );
  const { showToast } = useDialog();

  const CARD_WIDTH = winWidth - 32;
  const CARD_HEIGHT = Math.round(winHeight * 0.62);

  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    if (visible) setCurrentIndex(startIndex);
  }, [visible, startIndex]);

  const user = users[currentIndex] ?? null;
  const nextUser = users[currentIndex + 1] ?? null;

  const isLiked = user ? likedUserIds.has(user.id) : false;
  const isOwnProfile = user?.id === currentUser?.id;

  const advance = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= users.length) {
        onClose();
        return prev;
      }
      return next;
    });
  }, [users.length, onClose]);

  const handleLike = useCallback(async () => {
    if (!user || !currentUser || isOwnProfile) return;
    haptics.tapLight();
    const isMatch = await toggleLike(currentUser.id, user.id);
    showToast({
      icon: isMatch ? 'heart' : isLiked ? 'heart-outline' : 'heart',
      message: isMatch ? "It's a match" : isLiked ? UI_TOAST.likeRemoved : UI_TOAST.liked,
    });
    advance();
  }, [user, currentUser, isOwnProfile, isLiked, toggleLike, showToast, advance]);

  const handlePass = useCallback(() => {
    haptics.tapLight();
    advance();
  }, [advance]);

  const handleViewFullProfile = useCallback(() => {
    if (!user) return;
    onClose();
    setProfileSeed(user);
    const pics = (user.profile_photos ?? []).filter(Boolean).slice(0, 3);
    if (pics.length > 0) void Image.prefetch(pics.map((u) => profileImageUrlForList(u) ?? u));
    router.push(`/(profile)/${user.id}`);
  }, [user, onClose]);

  if (!visible || !user) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[s.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.headerBtn} hitSlop={10}>
            <Ionicons name="chevron-down" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        {/* ── Card stack ── */}
        <View style={[s.deckArea, { height: CARD_HEIGHT }]}>
          {nextUser && (
            <View style={[s.cardWrap, { transform: [{ scale: 0.95 }] }]} pointerEvents="none">
              <CardContent user={nextUser} cardWidth={CARD_WIDTH} cardHeight={CARD_HEIGHT} />
            </View>
          )}
          <View style={s.cardWrap}>
            <CardContent user={user} cardWidth={CARD_WIDTH} cardHeight={CARD_HEIGHT} />
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={s.actions}>
          <TouchableOpacity onPress={handlePass} style={floatCircle} activeOpacity={0.85}>
            <Ionicons name="close" size={28} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLike}
            style={[floatCircle, { width: 68, height: 68, borderRadius: 34 }]}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={30}
              color={isLiked ? COLORS.textStrong : COLORS.text}
            />
          </TouchableOpacity>
        </View>

        {/* ── View full profile ── */}
        <TouchableOpacity onPress={handleViewFullProfile} style={s.viewFullBtn} activeOpacity={0.7}>
          <Text style={s.viewFullText}>View Full Profile</Text>
          <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(10,10,12,0.92)',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  cardWrap: {
    position: 'absolute',
    ...SHADOWS.xl,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  viewFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  viewFullText: {
    fontSize: FONT.sm,
    fontWeight: FONT.semibold,
    color: 'rgba(255,255,255,0.65)',
  },
});
