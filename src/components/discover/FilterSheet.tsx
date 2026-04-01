import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilterOptions, Gender, LookingFor } from '@/types';
import { COLORS, AFRICAN_COUNTRIES, GENDER_OPTIONS, LOOKING_FOR_OPTIONS } from '@/constants';
import { Button } from '@/components/ui/Button';

interface FilterSheetProps {
  visible: boolean;
  filters: FilterOptions;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  onReset: () => void;
}

export function FilterSheet({ visible, filters, onClose, onApply, onReset }: FilterSheetProps) {
  const [local, setLocal] = useState<FilterOptions>(filters);

  const update = (key: keyof FilterOptions, value: FilterOptions[typeof key]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          <TouchableOpacity onPress={onReset}>
            <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 15 }}>Reset</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>Filter Members</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {/* Online Only */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.online }} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>Online Only</Text>
            </View>
            <Switch
              value={local.online_only}
              onValueChange={(v) => update('online_only', v)}
              trackColor={{ true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Gender */}
          <SectionLabel label="Gender" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {GENDER_OPTIONS.map((opt) => (
              <ChipButton
                key={opt.value}
                label={opt.label}
                selected={local.gender === opt.value}
                onPress={() => update('gender', local.gender === opt.value ? null : opt.value as Gender)}
              />
            ))}
          </View>

          {/* Looking For */}
          <SectionLabel label="Looking For" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {LOOKING_FOR_OPTIONS.map((opt) => (
              <ChipButton
                key={opt.value}
                label={opt.label}
                selected={local.looking_for === opt.value}
                onPress={() => update('looking_for', local.looking_for === opt.value ? null : opt.value as LookingFor)}
              />
            ))}
          </View>

          {/* Age Range */}
          <SectionLabel label={`Age Range: ${local.min_age} – ${local.max_age}`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {[18, 25, 30, 35, 40, 45, 50].map((age) => (
              <ChipButton
                key={`min-${age}`}
                label={`${age}+`}
                selected={local.min_age === age}
                onPress={() => update('min_age', age)}
              />
            ))}
          </View>

          {/* Country */}
          <SectionLabel label="Country" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {AFRICAN_COUNTRIES.slice(0, 20).map((c) => (
              <ChipButton
                key={c.code}
                label={c.name}
                selected={local.country === c.name}
                onPress={() => {
                  update('country', local.country === c.name ? null : c.name);
                  update('state', null);
                  update('city', null);
                }}
              />
            ))}
          </View>
        </ScrollView>

        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <Button
            title="Apply Filters"
            onPress={() => {
              onApply(local);
              onClose();
            }}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </Modal>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Text>
  );
}

function ChipButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: selected ? COLORS.primary : COLORS.border,
        backgroundColor: selected ? `${COLORS.primary}15` : '#FFFFFF',
      }}
    >
      <Text style={{ fontSize: 13, color: selected ? COLORS.primary : COLORS.textSecondary, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}
