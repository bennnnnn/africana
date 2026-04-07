import React, { useRef, useState, useEffect } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import { COLORS } from '@/constants';

const THUMB = 28;
const MIN_GAP_VALUE = 1;

interface Props {
  min: number;
  max: number;
  low: number;
  high: number;
  trackWidth: number;
  onChange: (low: number, high: number) => void;
}

export function RangeSlider({ min, max, low, high, trackWidth, onChange }: Props) {
  const valueSpan = Math.max(1, max - min);
  const usableWidth = Math.max(1, trackWidth - THUMB);
  const minGapPos = (MIN_GAP_VALUE / valueSpan) * usableWidth;
  const minCenter = THUMB / 2;
  const maxCenter = trackWidth - THUMB / 2;
  const toCenter = (v: number) => minCenter + ((v - min) / valueSpan) * usableWidth;
  const toVal = (center: number) =>
    Math.round(
      Math.max(
        min,
        Math.min(max, min + ((center - minCenter) / usableWidth) * valueSpan)
      )
    );

  // Keep a ref that always holds the latest computed values so PanResponder
  // callbacks (created once) never operate on stale closure values.
  const cv = useRef({ minCenter, maxCenter, minGapPos, toVal, onChange });
  cv.current = { minCenter, maxCenter, minGapPos, toVal, onChange };

  const [positions, setPositions] = useState({ low: toCenter(low), high: toCenter(high) });
  const posRef = useRef({ low: toCenter(low), high: toCenter(high) });
  const startRef = useRef({ low: 0, high: 0 });
  const draggingRef = useRef<'low' | 'high' | null>(null);

  // Sync when props change externally (e.g. reset)
  useEffect(() => {
    if (draggingRef.current) return;
    const next = { low: toCenter(low), high: toCenter(high) };
    posRef.current = next;
    setPositions(next);
  }, [low, high, trackWidth]);

  const lowPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        draggingRef.current = 'low';
        startRef.current.low = posRef.current.low;
      },
      onPanResponderMove: (_, gs) => {
        const { minCenter: mc, minGapPos: mgp, toVal: tv, onChange: oc } = cv.current;
        const newLow = Math.max(mc, Math.min(startRef.current.low + gs.dx, posRef.current.high - mgp));
        posRef.current.low = newLow;
        setPositions({ low: newLow, high: posRef.current.high });
        oc(tv(newLow), tv(posRef.current.high));
      },
      onPanResponderRelease: () => {
        draggingRef.current = null;
      },
      onPanResponderTerminate: () => {
        draggingRef.current = null;
      },
    })
  ).current;

  const highPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        draggingRef.current = 'high';
        startRef.current.high = posRef.current.high;
      },
      onPanResponderMove: (_, gs) => {
        const { maxCenter: xc, minGapPos: mgp, toVal: tv, onChange: oc } = cv.current;
        const newHigh = Math.max(posRef.current.low + mgp, Math.min(startRef.current.high + gs.dx, xc));
        posRef.current.high = newHigh;
        setPositions({ low: posRef.current.low, high: newHigh });
        oc(tv(posRef.current.low), tv(newHigh));
      },
      onPanResponderRelease: () => {
        draggingRef.current = null;
      },
      onPanResponderTerminate: () => {
        draggingRef.current = null;
      },
    })
  ).current;

  const lowVal = toVal(positions.low);
  const highVal = toVal(positions.high);

  return (
    <View style={{ marginBottom: 4 }}>
      {/* Track container */}
      <View style={[s.trackWrap, { width: trackWidth }]}>
        {/* Background track */}
        <View style={s.track} />
        {/* Active range */}
        <View
          style={[
            s.activeTrack,
            {
              left: positions.low,
              width: positions.high - positions.low,
            },
          ]}
        />
        {/* Low thumb */}
        <View {...lowPan.panHandlers} style={[s.thumb, { left: positions.low - THUMB / 2 }]}>
          <Text style={s.thumbLabel}>{lowVal}</Text>
        </View>
        {/* High thumb */}
        <View {...highPan.panHandlers} style={[s.thumb, { left: positions.high - THUMB / 2 }]}>
          <Text style={s.thumbLabel}>{highVal}</Text>
        </View>
      </View>

      {/* Min / Max labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={s.rangeLabel}>{min}</Text>
        <Text style={s.rangeLabel}>{max}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  trackWrap: { height: 56, justifyContent: 'center', position: 'relative' },
  track: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  activeTrack: {
    position: 'absolute',
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFF',
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
    top: (56 - THUMB) / 2,
  },
  thumbLabel: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  rangeLabel: { fontSize: 11, color: COLORS.textMuted },
});
