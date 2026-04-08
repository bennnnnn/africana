import { COLORS } from '@/constants';

type BaseThemeColors = { [K in keyof typeof COLORS]: string };

type ExtendedThemeColors = BaseThemeColors & {
  background: string;
  inactive: string;
  icon: string;
  iconMuted: string;
  primarySurface: string;
  primaryBorder: string;
  selectedSurface: string;
  selectedBorder: string;
  successSurface: string;
  successBorder: string;
  warningSurface: string;
  warningBorder: string;
  errorSurface: string;
  errorBorder: string;
  infoSurface: string;
  infoBorder: string;
  favouriteSurface: string;
  favouriteBorder: string;
  attention: string;
};

export type ThemeColors = ExtendedThemeColors;

const monochromeExtras = {
  background: '#FFFFFF',
  inactive: '#6B7280',
  icon: '#111111',
  iconMuted: '#6B7280',
  primarySurface: '#FFFFFF',
  primaryBorder: '#D1D5DB',
  selectedSurface: '#FFFFFF',
  selectedBorder: '#111111',
  successSurface: '#FFFFFF',
  successBorder: '#D1D5DB',
  warningSurface: '#FFFFFF',
  warningBorder: '#D1D5DB',
  errorSurface: '#FFFFFF',
  errorBorder: '#D1D5DB',
  infoSurface: '#FFFFFF',
  infoBorder: '#D1D5DB',
  favouriteSurface: '#FFFFFF',
  favouriteBorder: '#D1D5DB',
  attention: '#111111',
} as const;

export const lightColors: ThemeColors = {
  ...COLORS,
  primary: '#111111',
  primaryLight: '#111111',
  primaryDark: '#111111',
  success: '#111111',
  warning: '#111111',
  error: '#111111',
  online: '#111111',
  offline: '#6B7280',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  white: '#FFFFFF',
  inputBg: '#FFFFFF',
  text: '#111111',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',
  textStrong: '#111111',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  savanna: '#F9FAFB',
  gold: '#111111',
  green: '#111111',
  ...monochromeExtras,
};

/** Dark surfaces; brand accents unchanged for recognition */
export const darkColors: ThemeColors = {
  ...lightColors,
};
