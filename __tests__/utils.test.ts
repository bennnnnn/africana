import {
  DEFAULT_MAX_AGE_PREFERENCE,
  DEFAULT_MIN_AGE_PREFERENCE,
  getEffectiveAgePreferenceRange,
  isUuidString,
} from '@/lib/utils';

describe('utils', () => {
  test('isUuidString rejects literal "undefined" and accepts uuid-ish strings', () => {
    expect(isUuidString('undefined')).toBe(false);
    expect(isUuidString('')).toBe(false);
    expect(isUuidString('  ')).toBe(false);
    expect(isUuidString('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  test('getEffectiveAgePreferenceRange treats nulls as implicit defaults', () => {
    expect(getEffectiveAgePreferenceRange(null, null)).toEqual({
      min: DEFAULT_MIN_AGE_PREFERENCE,
      max: DEFAULT_MAX_AGE_PREFERENCE,
      isImplicit: true,
    });
  });
});

