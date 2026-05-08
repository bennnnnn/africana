import React from 'react';
import { Pressable, Text, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '@/constants';

type Props = {
  checked: boolean;
  onToggle: () => void;
  /** `surface` — dark text (register / onboarding). `brand` — light text on green welcome. */
  variant?: 'surface' | 'brand';
  style?: ViewStyle;
};

/**
 * Checkbox + inline Terms / Privacy links. Used at account creation (email or Google), not on profile onboarding.
 */
export function AuthLegalConsentRow({ checked, onToggle, variant = 'surface', style }: Props) {
  const textColor: TextStyle['color'] =
    variant === 'brand' ? 'rgba(255,255,255,0.88)' : COLORS.textSecondary;
  const linkColor: TextStyle['color'] = variant === 'brand' ? '#FFFFFF' : COLORS.primary;
  const idleIcon =
    variant === 'brand' ? 'rgba(255,255,255,0.55)' : COLORS.textMuted;
  const iconColor = checked ? linkColor : idleIcon;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.row, style]}
    >
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={iconColor} />
      <Text style={[styles.text, { color: textColor }]}>
        I am 18 or older and agree to Africana&apos;s{' '}
        <Text
          style={[styles.link, { color: linkColor }]}
          onPress={(e) => {
            e.stopPropagation?.();
            router.push({ pathname: '/(auth)/legal', params: { tab: 'terms' } });
          }}
        >
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text
          style={[styles.link, { color: linkColor }]}
          onPress={(e) => {
            e.stopPropagation?.();
            router.push({ pathname: '/(auth)/legal', params: { tab: 'privacy' } });
          }}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  link: {
    fontWeight: '700',
  },
});
