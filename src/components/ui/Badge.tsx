import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@/constants';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({ label, variant = 'primary', size = 'md' }: BadgeProps) {
  const bgColor =
    variant === 'primary' ? COLORS.primary :
    variant === 'secondary' ? COLORS.earthLight :
    variant === 'success' ? COLORS.success :
    variant === 'warning' ? COLORS.warning :
    'transparent';

  const textColor =
    variant === 'outline' ? COLORS.primary : '#FFFFFF';

  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: 20,
        paddingHorizontal: size === 'sm' ? 8 : 12,
        paddingVertical: size === 'sm' ? 2 : 4,
        ...(variant === 'outline' && {
          borderWidth: 1,
          borderColor: COLORS.primary,
        }),
      }}
    >
      <Text
        style={{
          fontSize: size === 'sm' ? 11 : 12,
          fontWeight: '600',
          color: textColor,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
