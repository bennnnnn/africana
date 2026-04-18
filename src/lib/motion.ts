/**
 * Centralized motion vocabulary. Every Animated call in the app should pull
 * from one of these so the whole product moves with a consistent rhythm.
 *
 * Three curves only:
 *   • spring    — for everything tactile (presses, pops, modal entries)
 *   • snap      — short timing for opacity/dismissal
 *   • settle    — softer spring for hero/scroll-coupled motion
 */

import type { Animated } from 'react-native';

type SpringConfig = Pick<
  Animated.SpringAnimationConfig,
  'tension' | 'friction' | 'useNativeDriver' | 'overshootClamping' | 'restDisplacementThreshold' | 'restSpeedThreshold'
>;

type TimingConfig = Pick<
  Animated.TimingAnimationConfig,
  'duration' | 'useNativeDriver' | 'easing'
>;

/** Default spring — buttons, taps, sheet pop-ins. iOS-native feel. */
export const SPRING: SpringConfig = {
  tension: 220,
  friction: 18,
  useNativeDriver: true,
};

/** Slightly softer spring — header overscroll, photo viewer settle. */
export const SETTLE: SpringConfig = {
  tension: 140,
  friction: 14,
  useNativeDriver: true,
};

/** Quick fade-in / fade-out used for toasts, overlays, small dismissals. */
export const SNAP_IN: TimingConfig = {
  duration: 180,
  useNativeDriver: true,
};

/** Slightly longer fade for menus and reaction sheets. */
export const SNAP_OUT: TimingConfig = {
  duration: 150,
  useNativeDriver: true,
};
