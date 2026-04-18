import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '@/constants';

/**
 * Warm on-brand gradient set — rotated by the first character of the name so
 * a user without a photo still has a distinctive, recognisable card/hero.
 */
const HERO_GRADIENTS: readonly [string, string][] = [
  ['#D24A2E', '#7A2217'], // brand terracotta
  ['#5A4F47', '#2C241F'], // warm charcoal
  ['#2D6A4F', '#1A3D2D'], // forest green
  ['#E8A33D', '#9A6614'], // warm gold
  ['#A43620', '#5C1B0E'], // primary dark
  ['#8B5A3C', '#4D2E1B'], // sienna
  ['#C66828', '#7E3B14'], // burnt orange
  ['#6B7B5A', '#3F4A36'], // sage
];

export function gradientForName(name: string | null | undefined): [string, string] {
  const ch = (name || 'U').charAt(0).toUpperCase();
  const idx = ch.charCodeAt(0) % HERO_GRADIENTS.length;
  return HERO_GRADIENTS[idx];
}

interface HeroPlaceholderProps {
  name?: string | null;
  width: number;
  height: number;
  /** Optional caption shown near the bottom (uppercase). Defaults to "No photo yet". */
  hint?: string | null;
  /** Show a camera icon near the hint. */
  showCamera?: boolean;
  /** Size override for the initial — defaults to width * 0.42. */
  initialSize?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Full-surface brand-gradient placeholder for hero photo slots and profile pages
 * when a user has not yet uploaded any photos. Consistent across UserCard,
 * MyProfile hero, and the public profile gallery.
 */
export function HeroPlaceholder({
  name,
  width,
  height,
  hint = 'No photo yet',
  showCamera = false,
  initialSize,
  style,
}: HeroPlaceholderProps) {
  const gradient = gradientForName(name);
  const initial = (name || 'U').charAt(0).toUpperCase();
  const fontSize = initialSize ?? width * 0.42;
  const circleSize = Math.min(width, height) * 0.72;

  return (
    <LinearGradient
      colors={[gradient[0], gradient[1]]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      />
      <Text
        style={{
          fontSize,
          fontFamily: FONT.displayFamily,
          color: 'rgba(255,255,255,0.92)',
          letterSpacing: -1,
          textShadowColor: 'rgba(0,0,0,0.35)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        }}
      >
        {initial}
      </Text>
      {hint ? (
        <View style={styles.hintRow}>
          {showCamera ? (
            <Ionicons name="camera-outline" size={13} color="rgba(255,255,255,0.65)" />
          ) : null}
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hintRow: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  hintText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: FONT.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

export default HeroPlaceholder;
