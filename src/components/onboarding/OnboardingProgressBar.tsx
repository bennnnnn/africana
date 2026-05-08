import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { COLORS } from '@/constants';

export function OnboardingProgressBar(props: { step: number; denominator: number }) {
  const { step, denominator } = props;
  const progressAnim = useRef(new Animated.Value((1 / Math.max(1, denominator)) * 100)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (Math.min(step, denominator) / Math.max(1, denominator)) * 100,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step, denominator, progressAnim]);

  return (
    <View style={s.track}>
      <Animated.View
        style={[
          s.fill,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    height: 5,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
    borderRadius: 3,
    marginBottom: 8,
  },
  fill: { height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },
});
