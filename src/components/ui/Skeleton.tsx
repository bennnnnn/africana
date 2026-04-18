import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, StyleProp } from 'react-native';
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
