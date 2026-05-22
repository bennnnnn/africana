import { moderateMessage } from '@/lib/moderation';

describe('moderateMessage', () => {
  it('allows normal messages', () => {
    expect(moderateMessage('Hello, how was your weekend?')).toEqual({ ok: true });
  });

  it('blocks obvious slurs', () => {
    expect(moderateMessage('you are a retard')).toEqual({ ok: false, reason: 'slur' });
  });

  it('blocks solicitation patterns', () => {
    expect(moderateMessage('send me nudes')).toEqual({ ok: false, reason: 'solicitation' });
  });

  it('allows empty or whitespace', () => {
    expect(moderateMessage('   ')).toEqual({ ok: true });
  });
});
