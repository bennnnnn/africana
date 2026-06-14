import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONT, COLORS } from '@/constants';

export function AuthOrDivider() {
  return (
    <View style={s.row}>
      <View style={s.line} />
      <Text style={s.text}>OR</Text>
      <View style={s.line} />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  text: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: FONT.medium,
  },
});
