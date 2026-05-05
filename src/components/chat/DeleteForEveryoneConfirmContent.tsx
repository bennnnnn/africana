import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '@/constants';

export function DeleteForEveryoneConfirmContent({
  checkedRef,
}: {
  checkedRef: React.MutableRefObject<boolean>;
}) {
  const [checked, setChecked] = useState(false);
  const toggle = () => {
    const next = !checked;
    setChecked(next);
    checkedRef.current = next;
  };
  return (
    <View style={{ marginTop: 4, marginBottom: 16 }}>
      <Pressable
        onPress={toggle}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: checked ? COLORS.green : COLORS.border,
          backgroundColor: checked ? 'rgba(0,0,0,0.04)' : 'transparent',
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: checked ? COLORS.green : COLORS.textMuted,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {checked ? <Ionicons name="checkmark" size={16} color={COLORS.green} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FONT.md, fontWeight: FONT.semibold, color: COLORS.textStrong }}>
            Delete for everyone
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
