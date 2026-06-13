import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

const ACTIVE_COLOR = COLORS.success;

export interface SelectOption {
  value: string;
  label: string;
  emoji?: string;
}

type SelectPickerBaseProps = {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  clearable?: boolean;
};

type SelectPickerSingleProps = SelectPickerBaseProps & {
  multiple?: false;
  value: string | null;
  onChange: (value: string | null) => void;
};

type SelectPickerMultiProps = SelectPickerBaseProps & {
  multiple: true;
  values: string[];
  onChange: (values: string[]) => void;
};

export type SelectPickerProps = SelectPickerSingleProps | SelectPickerMultiProps;

function formatTriggerLabel(options: SelectOption[], values: string[]): string {
  const labels = values
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean)
    .map((o) => `${o!.emoji ? o!.emoji + '  ' : ''}${o!.label}`);
  return labels.join(', ');
}

export function SelectPicker(props: SelectPickerProps) {
  const {
    label,
    placeholder = 'Select...',
    options,
    clearable = true,
  } = props;
  const [open, setOpen] = useState(false);

  const hasSelection = props.multiple
    ? props.values.length > 0
    : !!props.value;
  const triggerLabel = props.multiple
    ? formatTriggerLabel(options, props.values)
    : (() => {
        const selected = options.find(
          (o) => o.value === props.value,
        );
        return selected
          ? `${selected.emoji ? selected.emoji + '  ' : ''}${selected.label}`
          : '';
      })();

  const toggleMulti = (itemValue: string) => {
    if (!props.multiple) return;
    props.onChange(
      props.values.includes(itemValue)
        ? props.values.filter((v) => v !== itemValue)
        : [...props.values, itemValue],
    );
  };

  const clearSelection = () => {
    if (props.multiple) {
      (props.onChange as SelectPickerMultiProps['onChange'])([]);
    } else {
      (props.onChange as SelectPickerSingleProps['onChange'])(null);
      setOpen(false);
    }
  };

  return (
    <View style={s.wrapper}>
      {label && <Text style={s.label}>{label}</Text>}

      <TouchableOpacity
        style={[s.trigger, hasSelection && s.triggerOn, options.length === 0 && s.triggerDisabled]}
        onPress={() => {
          if (options.length > 0) setOpen(true);
        }}
        activeOpacity={0.8}
        disabled={options.length === 0}
      >
        <Text
          style={[s.triggerText, !hasSelection && s.placeholder, hasSelection && s.triggerTextOn]}
          numberOfLines={2}
        >
          {hasSelection ? triggerLabel : placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={hasSelection ? ACTIVE_COLOR : COLORS.textSecondary}
        />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{label ?? 'Select'}</Text>
            <View style={s.modalHeaderActions}>
              {props.multiple ? (
                <TouchableOpacity onPress={() => setOpen(false)} style={s.doneBtn}>
                  <Text style={s.doneBtnText}>Done</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListHeaderComponent={
              clearable && hasSelection ? (
                <TouchableOpacity style={s.clearRow} onPress={clearSelection}>
                  <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
                  <Text
                    style={{ fontSize: 14, color: COLORS.error, fontWeight: '600', marginLeft: 8 }}
                  >
                    {props.multiple ? 'Clear all' : 'Clear selection'}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = props.multiple
                ? props.values.includes(item.value)
                : item.value === props.value;
              return (
                <TouchableOpacity
                  style={[s.option, isSelected && s.optionOn]}
                  onPress={() => {
                    if (props.multiple) {
                      toggleMulti(item.value);
                    } else {
                      (props.onChange as SelectPickerSingleProps['onChange'])(item.value);
                      setOpen(false);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  {item.emoji ? <Text style={s.emoji}>{item.emoji}</Text> : null}
                  <Text style={[s.optionText, isSelected && s.optionTextOn]}>{item.label}</Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={ACTIVE_COLOR}
                      style={{ marginLeft: 'auto' }}
                    />
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
  triggerDisabled: { opacity: 0.5 },
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
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  doneBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: ACTIVE_COLOR },
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
