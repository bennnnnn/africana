import {
  DEFAULT_MAX_AGE_PREFERENCE,
  DEFAULT_MIN_AGE_PREFERENCE,
  buildActivityLabel,
  formatLastActiveLabel,
  getEffectiveAgePreferenceRange,
  isUuidString,
} from '@/lib/utils';

describe('utils', () => {
  test('isUuidString rejects literal "undefined" and accepts uuid-ish strings', () => {
    expect(isUuidString('undefined')).toBe(false);
    expect(isUuidString('')).toBe(false);
    expect(isUuidString('  ')).toBe(false);
    expect(isUuidString('temp-mq4cqrkv-zqxg1q')).toBe(false);
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

describe('activity labels', () => {
  const realNow = Date.now;

  afterEach(() => {
    Date.now = realNow;
  });

  test('buildActivityLabel prefers Active now when online', () => {
    expect(buildActivityLabel({ isOnline: true, lastSeen: null })).toBe('Active now');
    expect(buildActivityLabel({ isOnline: false, onlineVisible: false, lastSeen: null })).toBe(
      'Offline',
    );
  });

  test('formatLastActiveLabel uses granular recent times', () => {
    const now = new Date('2026-06-07T15:00:00').getTime();
    Date.now = () => now;

    expect(formatLastActiveLabel(new Date(now - 30_000).toISOString())).toBe('Active just now');
    expect(formatLastActiveLabel(new Date(now - 5 * 60_000).toISOString())).toBe('Active 5m ago');
    expect(formatLastActiveLabel(new Date(now - 2 * 3_600_000).toISOString())).toBe(
      'Active 2h ago',
    );
  });

  test('formatLastActiveLabel uses calendar today and yesterday', () => {
    const now = new Date('2026-06-07T20:00:00').getTime();
    Date.now = () => now;

    expect(formatLastActiveLabel(new Date('2026-06-07T08:00:00').toISOString())).toBe(
      'Active today',
    );
    expect(formatLastActiveLabel(new Date('2026-06-06T22:00:00').toISOString())).toBe(
      'Active yesterday',
    );
    expect(formatLastActiveLabel(new Date('2026-06-04T12:00:00').toISOString())).toBe(
      'Active 3 days ago',
    );
  });

  test('formatLastActiveLabel avoids vague a-while-ago copy', () => {
    const now = new Date('2026-06-07T12:00:00').getTime();
    Date.now = () => now;

    expect(formatLastActiveLabel(new Date('2026-05-01T12:00:00').toISOString())).toBe(
      'Active over a month ago',
    );
  });
});
