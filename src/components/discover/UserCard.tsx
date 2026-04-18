import React, { useRef, useEffect, memo, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { User } from '@/types';
import { COLORS, RADIUS, FONT } from '@/constants';
import { HeroPlaceholder } from '@/components/ui/HeroPlaceholder';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { setProfileSeed } from '@/lib/profile-seed-cache';

interface UserCardProps {
  user: User;
  /** Runs before navigating to profile (e.g. set fullscreen browse order). */
  beforeNavigate?: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH  = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.45;

const NEW_MEMBER_WINDOW_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

function UserCardInner({ user, beforeNavigate }: UserCardProps) {
  const photoUrl     = user.profile_photos?.[0] || user.avatar_url || null;
  const hasPhoto     = !!photoUrl;
  const shortLocation = user.city || user.state || user.country || '';

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (user.online_status !== 'online') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.9, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [user.online_status]);

  // "NEW" badge — show for profiles created within the last 10 days.
  const isNew = useMemo(() => {
    if (!user.created_at) return false;
    const created = new Date(user.created_at).getTime();
    if (!Number.isFinite(created)) return false;
    return Date.now() - created <= NEW_MEMBER_WINDOW_MS;
  }, [user.created_at]);

  const profileLabel = `View profile: ${user.full_name ?? 'Member'}${user.age ? `, ${user.age}` : ''}`;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={profileLabel}
      onPress={() => {
        setProfileSeed(user);
        // Warm the first few photos so the profile hero is instant.
        const photos = (user.profile_photos ?? []).filter(Boolean).slice(0, 3);
        if (photos.length > 0) void Image.prefetch(photos);
        beforeNavigate?.();
        router.push(`/(profile)/${user.id}`);
      }}
      activeOpacity={0.92}
      style={s.card}
    >
      {/* ── Photo or rich gradient placeholder ── */}
      {hasPhoto ? (
        <Image
          source={{ uri: photoUrl! }}
          style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <HeroPlaceholder
          name={user.full_name}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          hint={null}
        />
      )}

      {/* ── NEW badge — top-left ── */}
      {isNew && (
        <View style={s.newBadge} accessibilityLabel="New member">
          <Text style={s.newBadgeText}>NEW</Text>
        </View>
      )}

      {/* ── Online pulse dot — top-right ── */}
      {user.online_status === 'online' && (
        <View style={s.onlineDotWrap}>
          <Animated.View style={[
            s.onlinePulse,
            { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.9], outputRange: [0.55, 0] }) },
          ]} />
          <View style={s.onlineDot} />
        </View>
      )}

      {/* ── Bottom gradient overlay with name + location ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.82)']}
        locations={[0, 0.4, 1]}
        style={s.overlay}
      >
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>
            {user.full_name}{user.age ? `, ${user.age}` : ''}
          </Text>
          {user.verified && <VerifiedBadge size={13} style={s.verifiedInline} />}
        </View>
        {shortLocation ? (
          <View style={s.locationRow}>
            <Ionicons name="location-sharp" size={10} color="rgba(255,255,255,0.78)" />
            <Text style={s.locationText} numberOfLines={1}>{shortLocation}</Text>
          </View>
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export const UserCard = memo(UserCardInner);

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: COLORS.card,
    shadowColor: '#3A2A1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
  // ── NEW badge ───────────────────────────────────────────────
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.green,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  newBadgeText: {
    fontSize: 9.5,
    fontWeight: FONT.extrabold,
    color: COLORS.white,
    letterSpacing: 0.8,
    lineHeight: 11,
  },
  // ── Online indicator ────────────────────────────────────────
  onlineDotWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlinePulse: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: COLORS.online,
  },
  onlineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.online,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  // ── Info overlay ────────────────────────────────────────────
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 50,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    flexShrink: 1,
    fontSize: FONT.md,
    fontWeight: FONT.extrabold,
    color: COLORS.white,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verifiedInline: {
    flexShrink: 0,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontSize: FONT.xs,
    color: 'rgba(255,255,255,0.82)',
  },
});
