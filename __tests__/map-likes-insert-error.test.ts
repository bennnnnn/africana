import { classifyLikesInsertError } from '@/lib/map-likes-insert-error';

describe('classifyLikesInsertError', () => {
  it('classifies interaction_blocked by detail key', () => {
    expect(
      classifyLikesInsertError({
        code: '23514',
        message: 'blocked',
        details: 'interaction_blocked_between_participants',
      }),
    ).toBe('interaction_blocked');
  });

  it('classifies rate limits', () => {
    expect(classifyLikesInsertError({ code: '23P01', details: 'rate_limit:likes:hour' })).toBe(
      'rate_hour',
    );
    expect(classifyLikesInsertError({ code: '23P01', details: 'rate_limit:likes:day' })).toBe(
      'rate_day',
    );
  });

  it('returns unknown for other errors', () => {
    expect(classifyLikesInsertError({ message: 'network' })).toBe('unknown');
  });
});
