import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, RADIUS, FONT } from '@/constants';

export type ProfileSectionChip = { id: string; label: string };

export function ProfileSectionChips({
  sections,
  onSelect,
}: {
  sections: ProfileSectionChip[];
  onSelect: (id: string) => void;
}) {
  if (sections.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {sections.map((s, i) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => onSelect(s.id)}
            style={[styles.chip, i === sections.length - 1 && styles.chipLast]}
            activeOpacity={0.85}
          >
            <Text style={styles.chipText}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingVertical: 10,
  },
  row: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.savanna,
    borderWidth: 1,
    borderColor: `${COLORS.earth}35`,
  },
  chipLast: { marginRight: 16 },
  chipText: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: COLORS.earth },
});
