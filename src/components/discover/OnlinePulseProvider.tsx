import React, { createContext, useContext, useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type OnlinePulseContextValue = {
  scale: SharedValue<number>;
};

const OnlinePulseContext = createContext<OnlinePulseContextValue | null>(null);

/** Single shared pulse animation for all online indicators in a grid/list. */
export function OnlinePulseProvider({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.9, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scale]);

  return (
    <OnlinePulseContext.Provider value={{ scale }}>{children}</OnlinePulseContext.Provider>
  );
}

export function useOnlinePulseScale(): SharedValue<number> | null {
  return useContext(OnlinePulseContext)?.scale ?? null;
}

/** Pulse ring driven by the shared scale value from {@link OnlinePulseProvider}. */
export function OnlinePulseRing({ style }: { style?: object }) {
  const scale = useOnlinePulseScale();
  const animatedStyle = useAnimatedStyle(() => {
    if (!scale) return { opacity: 0, transform: [{ scale: 1 }] };
    const s = scale.value;
    return {
      transform: [{ scale: s }],
      opacity: 0.55 - ((s - 1) / 0.9) * 0.55,
    };
  }, [scale]);

  if (!scale) return null;
  return <Animated.View style={[style, animatedStyle]} />;
}
