import { COLORS, SHADOWS } from '@/constants';

export const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female' };

export const FLOAT_ACTION_SIZE = 56;

export const floatingActionCircle = {
  width: FLOAT_ACTION_SIZE,
  height: FLOAT_ACTION_SIZE,
  borderRadius: FLOAT_ACTION_SIZE / 2,
  backgroundColor: COLORS.white,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  ...SHADOWS.md,
};
