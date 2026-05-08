import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '@/constants';

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  chipOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  chipTxt: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  chipTxtOn: { color: COLORS.success, fontWeight: '700' },
});

export function MultiChipSelect({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const on = values.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => onToggle(opt)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
