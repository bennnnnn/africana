import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, FONT } from '@/constants';

type Props = {
  title: string;
  /** Balanced layout so the title sits visually centered (e.g. Legal). */
  titleAlign?: 'leading' | 'center';
  onBack?: () => void;
  backAccessibilityLabel?: string;
};

export function SettingsHeaderBar({
  title,
  titleAlign = 'leading',
  onBack,
  backAccessibilityLabel = 'Go back',
}: Props) {
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel={backAccessibilityLabel}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      {titleAlign === 'center' ? (
        <>
          <View style={styles.titleCenterWrap}>
            <Text style={[styles.title, styles.titleCentered]} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          </View>
          <View style={styles.sideSpacer} />
        </>
      ) : (
        <Text style={[styles.title, styles.titleLeading]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  title: {
    fontSize: FONT.lg,
    fontWeight: FONT.bold,
    color: COLORS.text,
  },
  titleLeading: {
    flex: 1,
  },
  titleCentered: {
    textAlign: 'center',
    width: '100%',
  },
  titleCenterWrap: {
    flex: 1,
    alignItems: 'center',
  },
  sideSpacer: {
    width: 24,
  },
});
