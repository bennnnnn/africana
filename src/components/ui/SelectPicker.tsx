import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

const ACTIVE_COLOR = COLORS.success;

export interface SelectOption {
  value: string;
  label: string;
  emoji?: string;
}

interface SelectPickerProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  clearable?: boolean;
}

export function SelectPicker({
  label,
  placeholder = 'Select...',
  options,
  value,
  onChange,
  clearable = true,
}: SelectPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={s.wrapper}>
      {label && <Text style={s.label}>{label}</Text>}

      <TouchableOpacity style={[s.trigger, selected && s.triggerOn]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[s.triggerText, !selected && s.placeholder, selected && s.triggerTextOn]}>
          {selected ? `${selected.emoji ? selected.emoji + '  ' : ''}${selected.label}` : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={selected ? ACTIVE_COLOR : COLORS.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={s.modal}>
          {/* Modal header */}
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{label ?? 'Select'}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListHeaderComponent={
              clearable && value ? (
                <TouchableOpacity
                  style={s.clearRow}
                  onPress={() => { onChange(null); setOpen(false); }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
                  <Text style={{ fontSize: 14, color: COLORS.error, fontWeight: '600', marginLeft: 8 }}>
                    Clear selection
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <TouchableOpacity
                  style={[s.option, isSelected && s.optionOn]}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                  activeOpacity={0.75}
                >
                  {item.emoji ? (
                    <Text style={s.emoji}>{item.emoji}</Text>
                  ) : null}
                  <Text style={[s.optionText, isSelected && s.optionTextOn]}>
                    {item.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={ACTIVE_COLOR} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  triggerOn: {
    borderColor: ACTIVE_COLOR,
    backgroundColor: `${ACTIVE_COLOR}10`,
  },
  triggerText: { fontSize: 15, color: COLORS.text, fontWeight: '500', flex: 1 },
  triggerTextOn: { color: ACTIVE_COLOR, fontWeight: '700' },
  placeholder: { color: COLORS.textMuted },
  modal: { flex: 1, backgroundColor: COLORS.surface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  optionOn: { backgroundColor: `${ACTIVE_COLOR}10` },
  emoji: { fontSize: 20, marginRight: 12, width: 28 },
  optionText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  optionTextOn: { color: ACTIVE_COLOR, fontWeight: '700' },
});
