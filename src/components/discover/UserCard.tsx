import React, { useRef, useCallback, useEffect } from 'react';
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

// Culturally warm gradient palettes — rotated by first letter of name
const CARD_GRADIENTS: [string, string][] = [
  ['#C84B31', '#7A2217'], // brand red
  ['#8B5E3C', '#4A2F1A'], // earth
  ['#2D6A4F', '#1A3D2D'], // forest green
  ['#D4AF37', '#8B6914'], // gold
  ['#6B4226', '#3D2112'], // dark bark
  ['#805AD5', '#553C9A'], // purple
  ['#DD6B20', '#9C4221'], // burnt orange
  ['#2B6CB0', '#1A3F6F'], // deep blue
];

interface UserCardProps {
  user: User;
  isLiked: boolean;
  onLike: (userId: string) => void;
  /** Runs before navigating to profile (e.g. set fullscreen browse order). */
  beforeNavigate?: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH  = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.45;

export function UserCard({ user, isLiked, onLike, beforeNavigate }: UserCardProps) {
  const photoUrl     = user.profile_photos?.[0] || user.avatar_url || null;
  const hasPhoto     = !!photoUrl;
  const initial      = (user.full_name || 'U').charAt(0).toUpperCase();
  const gradientIdx  = initial.charCodeAt(0) % CARD_GRADIENTS.length;
  const gradient     = CARD_GRADIENTS[gradientIdx];
  const shortLocation = user.city || user.state || user.country || '';

  const heartScale = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;

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

  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.45, useNativeDriver: true, speed: 40, bounciness: 18 }),
      Animated.spring(heartScale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    onLike(user.id);
  }, [heartScale, onLike, user.id]);

  return (
    <TouchableOpacity
      onPress={() => {
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
        <LinearGradient
          colors={[gradient[0], gradient[1]]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={s.placeholder}
        >
          {/* Decorative circle behind letter */}
          <View style={s.placeholderCircle} />
          <Text style={s.placeholderInitial}>{initial}</Text>
          {/* Subtle label at bottom of placeholder */}
          <Text style={s.placeholderHint}>No photo yet</Text>
        </LinearGradient>
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

      {/* ── Heart button — top-left ── */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); handleLike(); }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[s.heartBtn, isLiked && s.heartBtnActive]}
      >
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={17} color={COLORS.white} />
        </Animated.View>
      </TouchableOpacity>

      {/* ── Bottom gradient overlay with name + location ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.82)']}
        locations={[0, 0.4, 1]}
        style={s.overlay}
      >
        <Text style={s.name} numberOfLines={1}>
          {user.full_name}{user.age ? `, ${user.age}` : ''}
        </Text>
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

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 7,
  },
  // ── Placeholder styles ──────────────────────────────────────
  placeholder: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderCircle: {
    position: 'absolute',
    width: CARD_WIDTH * 0.9,
    height: CARD_WIDTH * 0.9,
    borderRadius: CARD_WIDTH * 0.45,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  placeholderInitial: {
    fontSize: CARD_WIDTH * 0.38,
    fontWeight: FONT.black,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -2,
  },
  placeholderHint: {
    position: 'absolute',
    bottom: 52,
    fontSize: FONT.xs,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: FONT.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  // ── Heart button ────────────────────────────────────────────
  heartBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnActive: {
    backgroundColor: `${COLORS.primary}E6`,
  },
  // ── Info overlay ────────────────────────────────────────────
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 50,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  name: {
    fontSize: FONT.md,
    fontWeight: FONT.extrabold,
    color: COLORS.white,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
