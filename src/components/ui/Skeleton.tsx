import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, StyleProp, Dimensions } from 'react-native';
import { COLORS } from '@/constants';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Subtle shimmer block used for loading placeholders. Looks like a tinted
 * card softly pulsing — no white-on-white shimmer that fights the warm surface.
 */
export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: COLORS.savanna, opacity },
        style,
      ]}
    />
  );
}

/** A pre-built row skeleton — avatar circle + 2 lines of text. Used in lists. */
export function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 }}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width={'55%'} height={14} />
        <Skeleton width={'80%'} height={11} />
      </View>
    </View>
  );
}

/** Card-shaped skeleton tuned for the Discover 2-column grid. */
export function SkeletonCard({ width, height, radius = 20 }: { width: number; height: number; radius?: number }) {
  return (
    <View style={{ width, marginBottom: 16 }}>
      <Skeleton width={width} height={height} borderRadius={radius} />
    </View>
  );
}

/**
 * Public-profile skeleton — mirrors the real layout (full-bleed hero, name +
 * meta strip, action button row, two info sections) so the transition into
 * the loaded profile feels like content snapping into place rather than a
 * spinner being replaced by a totally different layout.
 */
export function SkeletonProfile() {
  const { width } = Dimensions.get('window');
  const heroHeight = Math.round(width * 1.2);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Hero photo */}
      <Skeleton width={width} height={heroHeight} borderRadius={0} />

      {/* Name + age + location strip */}
      <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}>
        <Skeleton width={'62%'} height={26} borderRadius={6} />
        <Skeleton width={'42%'} height={14} borderRadius={4} />
      </View>

      {/* Action button row (like / message / favourite) */}
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 22 }}>
        <Skeleton width={56} height={56} borderRadius={28} />
        <Skeleton width={56} height={56} borderRadius={28} />
        <Skeleton width={56} height={56} borderRadius={28} />
      </View>

      {/* About section */}
      <View style={{ paddingHorizontal: 20, paddingTop: 28, gap: 10 }}>
        <Skeleton width={120} height={14} borderRadius={4} />
        <Skeleton width={'100%'} height={12} borderRadius={4} />
        <Skeleton width={'92%'} height={12} borderRadius={4} />
        <Skeleton width={'78%'} height={12} borderRadius={4} />
      </View>

      {/* Quick facts grid */}
      <View style={{ paddingHorizontal: 20, paddingTop: 28, gap: 10 }}>
        <Skeleton width={140} height={14} borderRadius={4} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width={84} height={28} borderRadius={14} />
          ))}
        </View>
      </View>
    </View>
  );
}
