import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

export function OnboardingHeader(props: {
  step: number;
  total: number;
  canGoBack: boolean;
  onBack: () => void;
}) {
  const { step, total, canGoBack, onBack } = props;
  return (
    <View style={s.header}>
      {canGoBack ? (
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 36 }} />
      )}
      <View style={{ flex: 1 }} />
      <Text style={s.counter}>
        {step} / {total}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
