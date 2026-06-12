import { isDuplicateSocialError } from '@/lib/social-actions';

describe('isDuplicateSocialError', () => {
  test('detects Postgres unique violation by code', () => {
    expect(isDuplicateSocialError({ code: '23505', message: 'Conflict' })).toBe(true);
  });

  test('detects duplicate key text in message blob', () => {
    expect(
      isDuplicateSocialError({
        message: 'duplicate key value violates unique constraint "reports_reporter_reported_unique"',
      }),
    ).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isDuplicateSocialError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isDuplicateSocialError(null)).toBe(false);
  });
});
