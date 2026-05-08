import React from 'react';
import { View, Text, TouchableOpacity, Switch, Pressable, StyleSheet } from 'react-native';
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

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  toggleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  labelBlock: {
    flex: 1,
    minWidth: 0,
  },
  labelText: {
    fontSize: FONT.md,
    fontWeight: FONT.medium,
    color: COLORS.text,
  },
  labelTextDanger: {
    color: COLORS.error,
  },
  descText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
    lineHeight: 16,
  },
});

const hubRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  hubTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.semibold,
    color: COLORS.textStrong,
  },
  hubDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});

const sectionHeaderStyles = StyleSheet.create({
  text: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.earth,
    paddingTop: 4,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  textAfter: {
    paddingTop: 18,
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
  const current = value ?? false;

  const iconBox = (
    <View style={[rowStyles.iconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconTint} />
    </View>
  );

  const labelBlock = (
    <View style={rowStyles.labelBlock}>
      <Text style={[rowStyles.labelText, danger && rowStyles.labelTextDanger]}>{label}</Text>
      {description ? <Text style={rowStyles.descText}>{description}</Text> : null}
    </View>
  );

  const rowBase = [rowStyles.row, isLast && rowStyles.rowLast];

  if (onToggle !== undefined) {
    const a11yLabel = [label, description].filter(Boolean).join('. ');
    return (
      <View style={rowBase} accessibilityRole="none">
        <Pressable
          style={rowStyles.toggleLeft}
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
          onValueChange={(v) => {
            if (!disabled) void onToggle(v);
          }}
          disabled={disabled}
          trackColor={{ true: COLORS.primary }}
          thumbColor={COLORS.white}
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
      style={rowBase}
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
      style={[sectionHeaderStyles.text, !first && sectionHeaderStyles.textAfter]}
      accessibilityRole="header"
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
      style={[hubRowStyles.row, isLast && hubRowStyles.rowLast]}
      accessibilityRole="button"
      accessibilityLabel={[label, description].filter(Boolean).join('. ')}
    >
      <View style={[hubRowStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={hubRowStyles.textCol}>
        <Text style={hubRowStyles.hubTitle}>{label}</Text>
        {description ? <Text style={hubRowStyles.hubDesc}>{description}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}
