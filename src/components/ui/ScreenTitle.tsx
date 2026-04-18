import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { COLORS, FONT } from '@/constants';

interface ScreenTitleProps {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Display-typography title used at the top of every screen.
 * Uses DM Serif Display so the brand has a recognisable signature
 * across Discover / Likes / Messages / Profile.
 *
 * On Android, custom fonts ignore the `fontWeight` prop, so we don't pass one.
 */
export function ScreenTitle({ children, size = FONT.xxl + 4, color = COLORS.textStrong, style }: ScreenTitleProps) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        {
          fontFamily: FONT.displayFamily,
          fontSize: size,
          color,
          letterSpacing: 0.2,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
