import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { COLORS, RADIUS, FONT } from '@/constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle = {
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    opacity: isDisabled ? 0.6 : 1,
    ...(fullWidth && { width: '100%' }),
    ...(size === 'sm' && { paddingVertical: 8,  paddingHorizontal: 16 }),
    ...(size === 'md' && { paddingVertical: 14, paddingHorizontal: 24 }),
    ...(size === 'lg' && { paddingVertical: 18, paddingHorizontal: 32 }),
    ...(variant === 'primary'   && { backgroundColor: COLORS.primary }),
    ...(variant === 'secondary' && { backgroundColor: COLORS.earth }),
    ...(variant === 'outline'   && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary }),
    ...(variant === 'ghost'     && { backgroundColor: 'transparent' }),
    ...(variant === 'danger'    && { backgroundColor: COLORS.error }),
  };

  const textStyles: TextStyle = {
    fontWeight: FONT.semibold,
    ...(size === 'sm' && { fontSize: FONT.sm }),
    ...(size === 'md' && { fontSize: FONT.md }),
    ...(size === 'lg' && { fontSize: FONT.lg }),
    ...(variant === 'primary'   && { color: COLORS.textInverse }),
    ...(variant === 'secondary' && { color: COLORS.textInverse }),
    ...(variant === 'outline'   && { color: COLORS.primary }),
    ...(variant === 'ghost'     && { color: COLORS.primary }),
    ...(variant === 'danger'    && { color: COLORS.textInverse }),
  };

  return (
    <TouchableOpacity
      style={[containerStyles, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? COLORS.primary : COLORS.textInverse}
        />
      )}
      <Text style={[textStyles, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}
