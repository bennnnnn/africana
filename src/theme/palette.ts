import { COLORS } from '@/constants';

type BaseThemeColors = { [K in keyof typeof COLORS]: string };

type ExtendedThemeColors = BaseThemeColors & {
  background: string;
  inactive: string;
  icon: string;
  iconMuted: string;
  selectedSurface: string;
  selectedBorder: string;
  infoSurface: string;
  infoBorder: string;
  favouriteSurface: string;
  favouriteBorder: string;
  attention: string;
};

export type ThemeColors = ExtendedThemeColors;

/**
 * The theme is a thin extension of `COLORS`. We deliberately do not override brand
 * tokens — the warm Africana identity is the source of truth. Components that read
 * via `useTheme()` get the same palette as components reading `COLORS` directly.
 */
const themeExtras = {
  background:       COLORS.surface,
  inactive:         COLORS.textSecondary,
  icon:             COLORS.textStrong,
  iconMuted:        COLORS.textSecondary,
  selectedSurface:  COLORS.primarySurface,
  selectedBorder:   COLORS.primary,
  infoSurface:      COLORS.savanna,
  infoBorder:       COLORS.border,
  favouriteSurface: COLORS.goldSurface,
  favouriteBorder:  COLORS.gold,
  attention:        COLORS.primary,
} as const;

export const lightColors: ThemeColors = {
  ...COLORS,
  ...themeExtras,
};
