import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { em } from '@/components/me/MyProfileEditPrimitives';

type SelectOption = { value: string; label: string; emoji?: string };

type Props = {
  options: SelectOption[];
  current: string | null;
  onPick: (value: string | null) => void;
  withSearch?: boolean;
  listSearch: string;
  onListSearchChange: (text: string) => void;
};

export function MeProfileSelectList({
  options,
  current,
  onPick,
  withSearch = false,
  listSearch,
  onListSearchChange,
}: Props) {
  const filtered =
    withSearch && listSearch.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(listSearch.toLowerCase()))
      : options;

  return (
    <View>
      {withSearch ? (
        <View style={em.searchRow}>
          <Ionicons name="search-outline" size={16} color="#999" />
          <TextInput
            value={listSearch}
            onChangeText={onListSearchChange}
            placeholder="Search..."
            placeholderTextColor="#BBB"
            style={{ flex: 1, fontSize: 14, color: '#111', marginLeft: 8 }}
            autoCorrect={false}
          />
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        {filtered.map((opt) => {
          const on = current === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onPick(on ? null : opt.value)}
              style={[em.option, on && em.optionOn]}
            >
              {opt.emoji ? <Text style={{ fontSize: 18, marginRight: 10 }}>{opt.emoji}</Text> : null}
              <Text style={[em.optionTxt, on && em.optionTxtOn]}>{opt.label}</Text>
              {on ? (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={COLORS.success}
                  style={{ marginLeft: 'auto' }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
