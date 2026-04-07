import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StyleSheet,
  Pressable,
} from 'react-native';
import { COLORS } from '@/constants';

const ACTIVE_COLOR = COLORS.success;

const { width } = Dimensions.get('window');
const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

interface WheelProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function Wheel({ items, selectedIndex, onSelect }: WheelProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, []);

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    onSelect(clamped);
  };

  return (
    <View style={styles.wheelWrap}>
      {/* Selection highlight */}
      <View style={styles.selectionBar} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
      >
        {items.map((item, i) => (
          <View key={i} style={styles.wheelItem}>
            <Text
              style={[
                styles.wheelText,
                i === selectedIndex && styles.wheelTextSelected,
              ]}
            >
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  label?: string;
  placeholder?: string;
}

export function DatePicker({ value, onChange, label, placeholder = 'Select date' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const now = new Date();

  const [day, setDay] = useState(value ? value.getDate() - 1 : 0);
  const [month, setMonth] = useState(value ? value.getMonth() : 0);
  const [year, setYear] = useState(() => {
    if (value) return now.getFullYear() - value.getFullYear() > 0
      ? now.getFullYear() - value.getFullYear()
      : 25;
    return 25; // default ~25 years ago
  });

  const minYear = 1940;
  const maxYear = now.getFullYear() - 18;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i));
  const days = Array.from({ length: daysInMonth(month + 1, Number(years[year])) }, (_, i) => String(i + 1).padStart(2, '0'));

  const handleDone = () => {
    const selectedYear = Number(years[year]);
    const selectedMonth = month;
    const selectedDay = Math.min(day + 1, daysInMonth(selectedMonth + 1, selectedYear));
    onChange(new Date(selectedYear, selectedMonth, selectedDay));
    setOpen(false);
  };

  const displayDate = value
    ? `${MONTHS[value.getMonth()]} ${value.getDate()}, ${value.getFullYear()}`
    : null;

  const age = value
    ? now.getFullYear() - value.getFullYear() - (now < new Date(now.getFullYear(), value.getMonth(), value.getDate()) ? 1 : 0)
    : null;

  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={[styles.trigger, displayDate && styles.triggerOn]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[styles.triggerText, !displayDate && styles.placeholder, displayDate && styles.triggerTextOn]}>
          {displayDate ? `${displayDate}${age ? `  •  ${age} years old` : ''}` : placeholder}
        </Text>
        <Text style={{ fontSize: 18 }}>{displayDate ? '✅' : '📅'}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={{ fontSize: 15, color: COLORS.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Date of Birth</Text>
            <TouchableOpacity onPress={handleDone}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary }}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.wheels}>
            <Wheel items={days} selectedIndex={day} onSelect={setDay} />
            <Wheel items={MONTHS} selectedIndex={month} onSelect={setMonth} />
            <Wheel items={years} selectedIndex={year} onSelect={setYear} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    height: 50,
  },
  triggerOn: {
    borderColor: ACTIVE_COLOR,
    backgroundColor: `${ACTIVE_COLOR}10`,
  },
  triggerText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  triggerTextOn: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
  },
  placeholder: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  wheels: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  wheelWrap: {
    flex: 1,
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
    position: 'relative',
  },
  selectionBar: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    backgroundColor: `${ACTIVE_COLOR}12`,
    borderRadius: 10,
    zIndex: 1,
    borderWidth: 1,
    borderColor: `${ACTIVE_COLOR}25`,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  wheelTextSelected: {
    fontSize: 17,
    fontWeight: '700',
    color: ACTIVE_COLOR,
  },
});
