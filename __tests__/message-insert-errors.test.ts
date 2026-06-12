import {
  ERROR_MESSAGE_RATE_LIMIT_HOUR,
  ERROR_MESSAGE_RATE_LIMIT_DAY,
  ERROR_MESSAGE_FREE_LIMIT,
  mapMessagesInsertError,
} from '@/lib/message-insert-errors';

describe('mapMessagesInsertError', () => {
  it('maps rate_limit:messages:hour detail', () => {
    expect(mapMessagesInsertError({ code: '23P01', details: 'rate_limit:messages:hour' })).toBe(
      ERROR_MESSAGE_RATE_LIMIT_HOUR,
    );
  });

  it('maps rate_limit:messages:day detail', () => {
    expect(mapMessagesInsertError({ code: '23P01', details: 'rate_limit:messages:day' })).toBe(
      ERROR_MESSAGE_RATE_LIMIT_DAY,
    );
  });

  it('maps rate_limit:messages:free detail', () => {
    expect(mapMessagesInsertError({ code: '23P01', details: 'rate_limit:messages:free' })).toBe(
      ERROR_MESSAGE_FREE_LIMIT,
    );
  });

  it('returns null for unknown errors', () => {
    expect(mapMessagesInsertError({ message: 'other' })).toBeNull();
  });
});
