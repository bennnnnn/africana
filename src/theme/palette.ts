import { COLORS } from '@/constants';

export type ThemeColors = { [K in keyof typeof COLORS]: string };

export const lightColors: ThemeColors = { ...COLORS };

/** Dark surfaces; brand accents unchanged for recognition */
export const darkColors: ThemeColors = {
  ...COLORS,
  background: '#120E0B',
  surface: '#181210',
  card: '#221A16',
  text: '#F7F0EA',
  textSecondary: '#C0B0A3',
  textMuted: '#8D7D71',
  inactive: '#8D7D71',
  icon: '#C0B0A3',
  iconMuted: '#8D7D71',
  border: '#352922',
  savanna: '#2A211C',
  primarySurface: '#38241D',
  primaryBorder: '#704332',
  selectedSurface: '#38241D',
  selectedBorder: '#704332',
  successSurface: '#123227',
  successBorder: '#1F6B52',
  warningSurface: '#3A2712',
  warningBorder: '#9C6A17',
  errorSurface: '#3A1717',
  errorBorder: '#7F2A2A',
  infoSurface: '#16263D',
  infoBorder: '#335A8F',
  favouriteSurface: '#3B2D15',
  favouriteBorder: '#8D6A1F',
};
