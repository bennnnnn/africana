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
import { COLORS, RADIUS, FONT, DEFAULT_AVATAR } from '@/constants';

interface UserCardProps {
  user: User;
  isLiked: boolean;
  onLike: (userId: string) => void;
  onMessage: (userId: string) => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.45;

export function UserCard({ user, isLiked, onLike, onMessage }: UserCardProps) {
  const avatar =
    user.profile_photos?.[0] ||
    user.avatar_url ||
    `${DEFAULT_AVATAR}${encodeURIComponent((user.full_name || 'U').charAt(0))}`;

  const shortLocation = user.city || user.state || user.country || '';

  // Animated scale for the heart button
  const heartScale = useRef(new Animated.Value(1)).current;

  // Pulse animation for the online dot
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

  const handleLike = useCallback(() => {
    // Springy bounce on tap
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.45, useNativeDriver: true, speed: 40, bounciness: 18 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    onLike(user.id);
  }, [heartScale, onLike, user.id]);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(profile)/${user.id}`)}
      activeOpacity={0.92}
      style={s.card}
    >
      {/* Full-bleed photo */}
      <Image
        source={{ uri: avatar }}
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        contentFit="cover"
        transition={250}
      />

      {/* Online pulse dot — top-right */}
      {user.online_status === 'online' && (
        <View style={s.onlineDotWrap}>
          {/* Expanding ring */}
          <Animated.View style={[s.onlinePulse, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.9], outputRange: [0.55, 0] }) }]} />
          <View style={s.onlineDot} />
        </View>
      )}

      {/* Animated heart button — top-left */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); handleLike(); }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[s.heartBtn, isLiked && s.heartBtnActive]}
      >
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={17} color={COLORS.white} />
        </Animated.View>
      </TouchableOpacity>

      {/* Bottom gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.76)']}
        locations={[0, 0.42, 1]}
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
    backgroundColor: COLORS.savanna,
  },
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
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 44,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  name: {
    fontSize: FONT.md,
    fontWeight: FONT.extrabold,
    color: COLORS.white,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.4)',
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
