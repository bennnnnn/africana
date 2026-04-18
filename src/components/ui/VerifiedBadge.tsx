import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

interface VerifiedBadgeProps {
  /** Total outer diameter of the badge in px. Defaults to 14. */
  size?: number;
  /** Style to merge on top of the default circular ring (useful for margin). */
  style?: StyleProp<ViewStyle>;
  /** Overrides the default white background. Used on dark/gradient surfaces. */
  backgroundColor?: string;
  /** Overrides the default blue checkmark fill. */
  color?: string;
}

/**
 * Photo-verified checkmark shown next to a user's name on Discover cards,
 * profile pages, and message headers.
 *
 * The only trust signal that actually moves the needle in a dating app —
 * we earn it from successful face-detection during signup (see
 * `profiles.verified`), so never render it speculatively.
 */
export function VerifiedBadge({
  size = 14,
  style,
  backgroundColor = COLORS.white,
  color = '#1D9BF0',
}: VerifiedBadgeProps) {
  const inner = size - 3;
  return (
    <View
      accessibilityLabel="Verified account"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        styles.ring,
        style,
      ]}
    >
      <Ionicons name="checkmark-circle" size={inner} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
    elevation: 1,
  },
});

export default VerifiedBadge;
