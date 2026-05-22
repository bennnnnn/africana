import {
  ERROR_MESSAGE_RATE_LIMIT_HOUR,
  ERROR_MESSAGE_RATE_LIMIT_DAY,
  mapMessagesInsertError,
} from '@/lib/message-insert-errors';

describe('mapMessagesInsertError', () => {
  it('maps rate_limit:messages:hour detail', () => {
    expect(
      mapMessagesInsertError({ code: '23P01', details: 'rate_limit:messages:hour' }),
    ).toBe(ERROR_MESSAGE_RATE_LIMIT_HOUR);
  });

  it('maps rate_limit:messages:day detail', () => {
    expect(
      mapMessagesInsertError({ code: '23P01', details: 'rate_limit:messages:day' }),
    ).toBe(ERROR_MESSAGE_RATE_LIMIT_DAY);
  });

  it('returns null for unknown errors', () => {
    expect(mapMessagesInsertError({ message: 'other' })).toBeNull();
  });
});
