import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONT } from '@/constants';

export function PostOnboardingProfileBanner({
  reminders,
  onProfilePress,
  onDismiss,
}: {
  reminders: string[];
  onProfilePress: () => void;
  onDismiss: () => void;
}) {
  if (reminders.length === 0) return null;

  const list =
    reminders.length === 1
      ? reminders[0]
      : reminders.length === 2
        ? `${reminders[0]} and ${reminders[1]}`
        : `${reminders.slice(0, -1).join(', ')}, and ${reminders[reminders.length - 1]}`;

  return (
    <View style={styles.outer}>
      <View style={styles.iconWrap}>
        <Ionicons name="rocket-outline" size={20} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Pick up where you left off</Text>
        <Text style={styles.sub}>
          During setup you skipped {list}. Add {reminders.length === 1 ? 'it' : 'them'} on your profile when you have a minute — it really helps.
        </Text>
        <TouchableOpacity onPress={onProfilePress} style={styles.cta} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Open profile</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={22} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    marginTop: 2,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT.md,
    fontWeight: FONT.extrabold,
    color: COLORS.textStrong,
  },
  sub: {
    marginTop: 4,
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  cta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  ctaText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: FONT.bold },
});
