import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilterOptions, Religion } from '@/types';
import { COLORS, RELIGION_OPTIONS } from '@/constants';
import { Button } from '@/components/ui/Button';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { LocationPicker, LocationValue } from '@/components/ui/LocationPicker';
import { SelectPicker } from '@/components/ui/SelectPicker';

const { width } = Dimensions.get('window');
const SLIDER_WIDTH = width - 80;

interface FilterSheetProps {
  visible: boolean;
  filters: FilterOptions;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  onReset: () => void;
}

export function FilterSheet({ visible, filters, onClose, onApply, onReset }: FilterSheetProps) {
  const [local, setLocal] = useState<FilterOptions>(filters);
  const [locationFilter, setLocationFilter] = useState<Partial<LocationValue>>({
    country: filters.country ?? undefined,
  });

  useEffect(() => {
    if (visible) {
      setLocal(filters);
      setLocationFilter({
        country: filters.country ?? undefined,
        subdivision: filters.state ?? undefined,
        city: filters.city ?? undefined,
      });
    }
  }, [visible, filters]);

  const update = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) =>
    setLocal((prev) => ({ ...prev, [key]: value }));

  const handleLocationChange = (val: Partial<LocationValue>) => {
    setLocationFilter(val);
    // Persist country, state (subdivision), and city together
    setLocal((prev) => ({
      ...prev,
      country: val.country || null,
      state: val.subdivision || null,
      city: val.city || null,
    }));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => { onReset(); onClose(); }}>
            <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 15 }}>Reset</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>Filter Members</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Online Only */}
          <View style={s.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.online }} />
              <Text style={s.rowLabel}>Online Only</Text>
            </View>
            <Switch
              value={local.online_only}
              onValueChange={(v) => update('online_only', v)}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Age Range */}
          <SectionLabel label={`Age Range: ${local.min_age} – ${local.max_age}`} />
          <RangeSlider
            min={18}
            max={100}
            low={local.min_age}
            high={local.max_age}
            trackWidth={SLIDER_WIDTH}
            onChange={(lo, hi) => {
              update('min_age', lo);
              update('max_age', hi);
            }}
          />

          {/* Religion */}
          <SectionLabel label="Religion" />
          <SelectPicker
            placeholder="Any religion..."
            options={RELIGION_OPTIONS}
            value={local.religion ?? null}
            onChange={(v) => update('religion', v as Religion | null)}
          />

          {/* Location (country + optional state/city) */}
          <SectionLabel label="Location" />
          <LocationPicker
            value={locationFilter}
            onChange={handleLocationChange}
            countryOnly={false}
          />
          {locationFilter.country && (
            <TouchableOpacity
              onPress={() => {
                setLocationFilter({});
                setLocal((prev) => ({ ...prev, country: null, state: null, city: null }));
              }}
              style={s.clearBtn}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.textSecondary} />
              <Text style={s.clearBtnText}>Clear location filter</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <Button
            title="Apply Filters"
            onPress={() => { onApply(local); onClose(); }}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </Modal>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={s.sectionLabel}>{label}</Text>;
}

const s = {
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 20,
  },
  rowLabel: { fontSize: 15, fontWeight: '600' as const, color: COLORS.text },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginTop: 20,
  },
  clearBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  clearBtnText: { fontSize: 13, color: COLORS.textSecondary },
};
