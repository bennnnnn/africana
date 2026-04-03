import React, { useRef, useState, useEffect } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import { COLORS } from '@/constants';

const THUMB = 28;

interface Props {
  min: number;
  max: number;
  low: number;
  high: number;
  trackWidth: number;
  onChange: (low: number, high: number) => void;
}

export function RangeSlider({ min, max, low, high, trackWidth, onChange }: Props) {
  const toPos = (v: number) => ((v - min) / (max - min)) * trackWidth;
  const toVal = (p: number) =>
    Math.round(Math.max(min, Math.min(max, min + (p / trackWidth) * (max - min))));

  const [positions, setPositions] = useState({ low: toPos(low), high: toPos(high) });
  const posRef = useRef({ low: toPos(low), high: toPos(high) });
  const startRef = useRef({ low: 0, high: 0 });

  // Sync when props change externally (e.g. reset)
  useEffect(() => {
    const next = { low: toPos(low), high: toPos(high) };
    posRef.current = next;
    setPositions(next);
  }, [low, high]);

  const lowPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current.low = posRef.current.low;
      },
      onPanResponderMove: (_, gs) => {
        const newLow = Math.max(0, Math.min(startRef.current.low + gs.dx, posRef.current.high - THUMB));
        posRef.current.low = newLow;
        setPositions({ low: newLow, high: posRef.current.high });
        onChange(toVal(newLow), toVal(posRef.current.high));
      },
    })
  ).current;

  const highPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current.high = posRef.current.high;
      },
      onPanResponderMove: (_, gs) => {
        const newHigh = Math.max(posRef.current.low + THUMB, Math.min(startRef.current.high + gs.dx, trackWidth));
        posRef.current.high = newHigh;
        setPositions({ low: posRef.current.low, high: newHigh });
        onChange(toVal(posRef.current.low), toVal(newHigh));
      },
    })
  ).current;

  const lowVal = toVal(positions.low);
  const highVal = toVal(positions.high);

  return (
    <View style={{ paddingHorizontal: THUMB / 2, marginBottom: 4 }}>
      {/* Track container */}
      <View style={[s.trackWrap, { width: trackWidth + THUMB }]}>
        {/* Background track */}
        <View style={[s.track, { left: THUMB / 2, right: THUMB / 2 }]} />
        {/* Active range */}
        <View
          style={[
            s.activeTrack,
            {
              left: positions.low + THUMB / 2,
              width: positions.high - positions.low,
            },
          ]}
        />
        {/* Low thumb */}
        <View {...lowPan.panHandlers} style={[s.thumb, { left: positions.low }]}>
          <Text style={s.thumbLabel}>{lowVal}</Text>
        </View>
        {/* High thumb */}
        <View {...highPan.panHandlers} style={[s.thumb, { left: positions.high }]}>
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
