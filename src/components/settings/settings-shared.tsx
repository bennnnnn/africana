import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '@/constants';

export const settingsStyles = StyleSheet.create({
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  screenIntro: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  sectionBlock: {
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
});

export interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  description?: string;
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
  isLast?: boolean;
  disabled?: boolean;
}

export function SettingRow({
  icon,
  iconColor,
  label,
  description,
  value,
  onToggle,
  onPress,
  showArrow = true,
  danger = false,
  isLast = false,
  disabled = false,
}: SettingRowProps) {
  const iconTint = danger ? COLORS.error : (iconColor ?? COLORS.primary);
  const iconBg = danger ? '#FEE2E2' : `${iconColor ?? COLORS.primary}18`;

  const iconBox = (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: iconBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      }}
    >
      <Ionicons name={icon} size={18} color={iconTint} />
    </View>
  );

  const labelBlock = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: FONT.md, fontWeight: FONT.medium, color: danger ? COLORS.error : COLORS.text }}>
        {label}
      </Text>
      {description ? (
        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 1, lineHeight: 16 }}>{description}</Text>
      ) : null}
    </View>
  );

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  };

  if (onToggle !== undefined) {
    const a11yLabel = [label, description].filter(Boolean).join('. ');
    const current = value ?? false;
    return (
      <View style={rowStyle} accessibilityRole="none">
        <Pressable
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
          onPress={() => !disabled && onToggle(!current)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityState={{ checked: current }}
        >
          {iconBox}
          {labelBlock}
        </Pressable>
        <Switch
          value={current}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ true: COLORS.primary }}
          thumbColor="#FFFFFF"
          accessibilityLabel={label}
        />
      </View>
    );
  }

  const navA11y = [label, description].filter(Boolean).join('. ');
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress || disabled}
      activeOpacity={onPress && !disabled ? 0.7 : 1}
      style={rowStyle}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={onPress ? navA11y : undefined}
    >
      {iconBox}
      {labelBlock}
      {showArrow ? <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} /> : null}
    </TouchableOpacity>
  );
}

export function SettingsSectionHeader({ label, first }: { label: string; first?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.earth,
        paddingTop: first ? 4 : 18,
        paddingBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
      }}
    >
      {label}
    </Text>
  );
}

export interface SettingsHubRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  description?: string;
  onPress: () => void;
  isLast?: boolean;
}

/** Top-level settings menu row (navigates to a sub-screen). */
export function SettingsHubRow({
  icon,
  iconColor = COLORS.primary,
  label,
  description,
  onPress,
  isLast = false,
}: SettingsHubRowProps) {
  const iconBg = `${iconColor}18`;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
      }}
      accessibilityRole="button"
      accessibilityLabel={[label, description].filter(Boolean).join('. ')}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: FONT.md, fontWeight: FONT.semibold, color: COLORS.textStrong }}>{label}</Text>
        {description ? (
          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 }}>{description}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}
