import React, { useMemo, useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { RangeSlider as TwoThumbSlider } from '@/components/ui/RangeSlider';
import { COLORS } from '@/constants';

const { width } = Dimensions.get('window');

// ── Single-value slider (e.g. height or weight) ──────────

interface SliderPickerProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}

export function SliderPicker({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  formatValue,
}: SliderPickerProps) {
  const display = formatValue ? formatValue(value) : `${value} ${unit}`;
  const progress = Math.max(0, Math.min(1, (value - min) / Math.max(1, max - min)));
  const [sliderWidth, setSliderWidth] = useState(0);
  const thumbSize = 22;
  const trackInset = 10;
  const thumbTravel = Math.max(0, sliderWidth - trackInset * 2);
  const thumbLeft = trackInset + progress * thumbTravel - thumbSize / 2;

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>{label}</Text>
        <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.primarySurface }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.primary }}>{display}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 11, color: COLORS.textMuted, width: 32, textAlign: 'right' }}>{min}</Text>
        <View
          style={{ flex: 1, height: 52, justifyContent: 'center' }}
          onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
        >
          <View
            style={{
              position: 'absolute',
              left: trackInset,
              right: trackInset,
              height: 8,
              borderRadius: 999,
              backgroundColor: COLORS.border,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(progress * 100, 0)}%`,
                height: '100%',
                borderRadius: 999,
                backgroundColor: COLORS.primary,
              }}
            />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: thumbLeft,
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              borderWidth: 2.5,
              borderColor: COLORS.primary,
              backgroundColor: '#FFF',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.14,
              shadowRadius: 2,
              elevation: 2,
            }}
          />
          <Slider
            style={{ flex: 1, height: 52 }}
            minimumValue={min}
            maximumValue={max}
            step={step}
            value={value}
            onValueChange={onChange}
            minimumTrackTintColor="transparent"
            maximumTrackTintColor="transparent"
            thumbTintColor="transparent"
          />
        </View>
        <Text style={{ fontSize: 11, color: COLORS.textMuted, width: 32 }}>{max}</Text>
      </View>
    </View>
  );
}

// ── Age range: single two-thumb slider (same as filter page) ─

interface RangeSliderProps {
  label: string;
  minValue: number;
  maxValue: number;
  min?: number;
  max?: number;
  unit?: string;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
  onChangeRange?: (min: number, max: number) => void;
  /** Horizontal padding around the slider (default 40 matches screen padding) */
  horizontalPadding?: number;
}

export function RangeSlider({
  label,
  minValue,
  maxValue,
  min = 18,
  max = 100,
  unit = 'yrs',
  onChangeMin,
  onChangeMax,
  onChangeRange,
  horizontalPadding = 40,
}: RangeSliderProps) {
  const fallbackWidth = width - horizontalPadding * 2;
  const [containerWidth, setContainerWidth] = useState(fallbackWidth);
  const trackWidth = useMemo(
    () => Math.max(180, containerWidth - 36),
    [containerWidth],
  );

  return (
    <View
      style={{ marginBottom: 20, width: '100%', alignSelf: 'stretch' }}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>{label}</Text>
        <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.primarySurface }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.primary }}>
            {minValue} – {maxValue} {unit}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'center' }}>
        <TwoThumbSlider
          min={min}
          max={max}
          low={minValue}
          high={maxValue}
          trackWidth={trackWidth}
          onChange={(lo, hi) => {
            if (onChangeRange) {
              onChangeRange(lo, hi);
              return;
            }
            onChangeMin(lo);
            onChangeMax(hi);
          }}
        />
      </View>
    </View>
  );
}
