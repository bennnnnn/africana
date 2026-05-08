import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONT } from '@/constants';

export const HOBBY_OPTIONS = [
  'Music',
  'Reading',
  'Travel',
  'Cooking',
  'Football',
  'Dancing',
  'Fashion',
  'Photography',
  'Fitness',
  'Movies',
  'Nature',
  'Art',
  'Gaming',
  'Yoga',
  'Swimming',
  'Hiking',
  'Cycling',
  'Gardening',
  'Meditation',
  'Writing',
  'Business',
  'Theology',
  'Volunteering',
  'Poetry',
  'History',
  'Technology',
  'Languages',
  'Entrepreneurship',
];

const field = StyleSheet.create({
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldIconEmpty: {
    backgroundColor: COLORS.emptyFieldSurface,
    borderWidth: 1,
    borderColor: COLORS.emptyFieldBorder,
  },
  fieldLabel: {
    fontSize: FONT.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT.medium,
    marginBottom: 1,
  },
  fieldValue: { fontSize: 14, color: COLORS.textStrong, fontWeight: FONT.semibold },
  fieldValueEmpty: { color: COLORS.emptyField, fontWeight: FONT.semibold, fontStyle: 'italic' },
});

export const em = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: FONT.lg, fontWeight: FONT.bold, color: COLORS.textStrong },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
  },
  saveTxt: { color: COLORS.white, fontWeight: FONT.bold, fontSize: 14 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: FONT.md,
    color: COLORS.textStrong,
    backgroundColor: COLORS.white,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: FONT.md,
    color: COLORS.textStrong,
    backgroundColor: COLORS.white,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    marginBottom: 14,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  optionOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  optionTxt: { fontSize: FONT.md, color: COLORS.textStrong, fontWeight: FONT.medium },
  optionTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  bigChip: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  bigChipOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  bigChipTxt: { fontSize: FONT.md, color: COLORS.textSecondary, fontWeight: FONT.medium },
  bigChipTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  chipTxt: { fontSize: 14, color: COLORS.textSecondary, fontWeight: FONT.medium },
  chipTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  groupLabel: {
    fontSize: FONT.sm,
    fontWeight: FONT.bold,
    color: COLORS.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export function EditModal({
  visible,
  title,
  onClose,
  onSave,
  saving,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={em.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.textStrong} />
            </TouchableOpacity>
            <Text style={em.title}>{title}</Text>
            <TouchableOpacity onPress={onSave} disabled={saving} style={em.saveBtn}>
              <Text style={em.saveTxt}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function FieldRow({
  icon,
  label,
  value,
  onEdit,
  readOnly,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
  onEdit: () => void;
  readOnly?: boolean;
}) {
  const filled = !!value;
  const inner = (
    <>
      <View style={[field.fieldIcon, !filled && !readOnly && field.fieldIconEmpty]}>
        <Ionicons
          name={icon}
          size={15}
          color={filled || readOnly ? COLORS.textStrong : COLORS.emptyField}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={field.fieldLabel}>{label}</Text>
        <Text style={[field.fieldValue, !filled && !readOnly && field.fieldValueEmpty]}>
          {filled ? value : readOnly ? '—' : `Add ${label.toLowerCase()}`}
        </Text>
      </View>
      {readOnly ? (
        <Ionicons name="lock-closed-outline" size={14} color={COLORS.textMuted} />
      ) : (
        <Ionicons
          name={filled ? 'pencil' : 'add-circle-outline'}
          size={16}
          color={filled ? COLORS.textStrong : COLORS.emptyField}
        />
      )}
    </>
  );
  if (readOnly) {
    return <View style={[field.fieldRow, { opacity: 0.92 }]}>{inner}</View>;
  }
  return (
    <TouchableOpacity onPress={onEdit} activeOpacity={0.7} style={field.fieldRow}>
      {inner}
    </TouchableOpacity>
  );
}
