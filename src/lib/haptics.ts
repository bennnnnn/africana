/**
 * Thin wrapper around `expo-haptics`. Centralises all haptic calls so we can
 * later gate them behind a user setting ("reduce motion / disable haptics")
 * without hunting through the codebase.
 *
 * All helpers swallow errors — haptics are a nice-to-have, never critical.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const haptics = {
  /** A gentle confirmation — use for likes, favouriting, copy. */
  tapLight(): void {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },

  /** Medium bump — use for destructive confirmations (e.g. opening delete prompt). */
  tapMedium(): void {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },

  /** Strong success cue — use for matches, purchases. */
  success(): void {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },

  /** Error cue — use when an action is blocked (rate limit, invalid input). */
  error(): void {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};

export default haptics;
