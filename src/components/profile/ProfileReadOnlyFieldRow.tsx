import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '@/constants';

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${COLORS.border}CC`,
  },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: FONT.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT.semibold,
    marginBottom: 2,
  },
  fieldValue: { fontSize: FONT.md, color: COLORS.textStrong, fontWeight: FONT.semibold },
});

export function ProfileReadOnlyFieldRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
  isLast?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
      <View style={styles.fieldIcon}>
        <Ionicons name={icon} size={16} color={COLORS.textStrong} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
    </View>
  );
}
