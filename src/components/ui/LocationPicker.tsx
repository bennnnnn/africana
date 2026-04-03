import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  TextInput, StyleSheet, Pressable, SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COUNTRY_GROUPS, ALL_COUNTRIES, CountryData } from '@/lib/country-data';
import { COLORS } from '@/constants';

export interface LocationValue {
  country: string;
  countryCode: string;
  subdivision: string; // state/region/province etc.
  city: string;
}

interface LocationPickerProps {
  value: Partial<LocationValue>;
  onChange: (val: Partial<LocationValue>) => void;
  /** If true, user picks only country (no state/city) */
  countryOnly?: boolean;
}

type ModalType = 'country' | 'subdivision' | 'city' | null;

export function LocationPicker({ value, onChange, countryOnly = false }: LocationPickerProps) {
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [search, setSearch] = useState('');

  const selectedCountry = value.country ? ALL_COUNTRIES.find((c) => c.name === value.country) : null;
  const selectedSubdivision = selectedCountry?.subdivisions.find((s) => s.name === value.subdivision);

  const subdivisionLabel = selectedCountry?.subdivisionLabel ?? 'Region';

  // Country picker sections
  const countrySections = useMemo(() => {
    if (!search.trim()) {
      return COUNTRY_GROUPS.map((g) => ({
        title: `${g.emoji} ${g.label}`,
        data: g.countries,
      }));
    }
    const q = search.toLowerCase();
    const matched = ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
    return [{ title: 'Results', data: matched }];
  }, [search]);

  const cityList = useMemo(() => {
    if (!selectedSubdivision) return [];
    if (!search.trim()) return selectedSubdivision.cities;
    const q = search.toLowerCase();
    return selectedSubdivision.cities.filter((c) => c.toLowerCase().includes(q));
  }, [selectedSubdivision, search]);

  const subdivisionList = useMemo(() => {
    if (!selectedCountry) return [];
    if (!search.trim()) return selectedCountry.subdivisions;
    const q = search.toLowerCase();
    return selectedCountry.subdivisions.filter((s) => s.name.toLowerCase().includes(q));
  }, [selectedCountry, search]);

  const openPicker = (type: ModalType) => {
    setSearch('');
    setOpenModal(type);
  };

  const handleCountrySelect = (c: CountryData) => {
    onChange({ country: c.name, countryCode: c.code, subdivision: '', city: '' });
    setOpenModal(null);
  };

  const handleSubdivisionSelect = (name: string) => {
    onChange({ ...value, subdivision: name, city: '' });
    setOpenModal(null);
  };

  const handleCitySelect = (city: string) => {
    onChange({ ...value, city });
    setOpenModal(null);
  };

  return (
    <View>
      {/* Country button */}
      <PickerButton
        label="Country"
        value={value.country ?? null}
        placeholder="Select your country"
        icon="globe-outline"
        onPress={() => openPicker('country')}
      />

      {/* Subdivision button — only after country is selected and country has subdivisions */}
      {!countryOnly && value.country && selectedCountry && selectedCountry.subdivisions.length > 0 && (
        <PickerButton
          label={subdivisionLabel}
          value={value.subdivision || null}
          placeholder={`Select ${subdivisionLabel}`}
          icon="map-outline"
          onPress={() => openPicker('subdivision')}
        />
      )}

      {/* Free-text subdivision for countries with no data */}
      {!countryOnly && value.country && selectedCountry && selectedCountry.subdivisions.length === 0 && (
        <View style={s.inputWrap}>
          <Text style={s.inputLabel}>{subdivisionLabel} (optional)</Text>
          <View style={s.textInputRow}>
            <Ionicons name="map-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={s.textInput}
              value={value.subdivision ?? ''}
              onChangeText={(t) => onChange({ ...value, subdivision: t })}
              placeholder={`Enter ${subdivisionLabel}`}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>
      )}

      {/* City button — only after subdivision is chosen */}
      {!countryOnly && value.subdivision && selectedSubdivision && selectedSubdivision.cities.length > 0 && (
        <PickerButton
          label="City / Town"
          value={value.city || null}
          placeholder="Select city"
          icon="business-outline"
          onPress={() => openPicker('city')}
        />
      )}

      {/* Free-text city */}
      {!countryOnly && value.subdivision && (!selectedSubdivision || selectedSubdivision.cities.length === 0) && (
        <View style={s.inputWrap}>
          <Text style={s.inputLabel}>City (optional)</Text>
          <View style={s.textInputRow}>
            <Ionicons name="business-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={s.textInput}
              value={value.city ?? ''}
              onChangeText={(t) => onChange({ ...value, city: t })}
              placeholder="Enter your city"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>
      )}

      {/* ── Country modal ── */}
      <PickerModal
        visible={openModal === 'country'}
        title="Select Country"
        onClose={() => setOpenModal(null)}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search countries..."
      >
        <SectionList
          sections={countrySections}
          keyExtractor={(item) => item.code}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <RowItem
              label={item.name}
              selected={value.country === item.name}
              onPress={() => handleCountrySelect(item)}
            />
          )}
        />
      </PickerModal>

      {/* ── Subdivision modal ── */}
      <PickerModal
        visible={openModal === 'subdivision'}
        title={`Select ${subdivisionLabel}`}
        onClose={() => setOpenModal(null)}
        search={search}
        onSearch={setSearch}
        searchPlaceholder={`Search ${subdivisionLabel.toLowerCase()}s...`}
      >
        <FlatList
          data={subdivisionList}
          keyExtractor={(item) => item.name}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <RowItem
              label={item.name}
              selected={value.subdivision === item.name}
              onPress={() => handleSubdivisionSelect(item.name)}
            />
          )}
        />
      </PickerModal>

      {/* ── City modal ── */}
      <PickerModal
        visible={openModal === 'city'}
        title="Select City"
        onClose={() => setOpenModal(null)}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search cities..."
      >
        <FlatList
          data={cityList}
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <RowItem
              label={item}
              selected={value.city === item}
              onPress={() => handleCitySelect(item)}
            />
          )}
        />
      </PickerModal>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────

function PickerButton({ label, value, placeholder, icon, onPress }: {
  label: string; value: string | null; placeholder: string;
  icon: keyof typeof Ionicons.glyphMap; onPress: () => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.inputLabel}>{label}</Text>
      <TouchableOpacity onPress={onPress} style={s.dropdownBtn} activeOpacity={0.8}>
        <Ionicons name={icon} size={17} color={value ? COLORS.primary : COLORS.textSecondary} style={{ marginRight: 10 }} />
        <Text style={[s.dropdownText, value ? { color: COLORS.text, fontWeight: '600' } : {}]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={15} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function PickerModal({ visible, title, onClose, search, onSearch, searchPlaceholder, children }: {
  visible: boolean; title: string; onClose: () => void;
  search: string; onSearch: (t: string) => void; searchPlaceholder: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={s.modalTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={15} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={onSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={COLORS.textMuted}
            style={s.searchInput}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

function RowItem({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.row, selected && s.rowOn]}>
      <Text style={[s.rowText, selected && s.rowTextOn]} numberOfLines={1}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  inputLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputWrap: { marginBottom: 14 },
  textInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FFF',
  },
  textInput: { flex: 1, fontSize: 15, color: COLORS.text },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#FFF',
  },
  dropdownText: { flex: 1, fontSize: 15, color: COLORS.textSecondary },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: '#FFF',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: COLORS.savanna,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  sectionHeader: { backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionHeaderText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowOn: { backgroundColor: `${COLORS.primary}0D` },
  rowText: { fontSize: 15, color: COLORS.text, flex: 1 },
  rowTextOn: { color: COLORS.primary, fontWeight: '700' },
});
