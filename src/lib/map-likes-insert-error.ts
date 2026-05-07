import { pgErrorDiscriminator, type PostgrestErrorFields } from '@/lib/postgrest-error-blob';

export type LikesInsertErrorKind = 'interaction_blocked' | 'rate_hour' | 'rate_day' | 'unknown';

/** Classify `likes` insert failures (blocks + rate limits) from DB / PostgREST errors. */
export function classifyLikesInsertError(err: PostgrestErrorFields | null): LikesInsertErrorKind {
  if (!err) return 'unknown';
  const { code, key } = pgErrorDiscriminator(err);
  if (code === '23514' && key === 'interaction_blocked_between_participants') return 'interaction_blocked';
  if (code === '23P01' && key === 'rate_limit:likes:hour') return 'rate_hour';
  if (code === '23P01' && key === 'rate_limit:likes:day') return 'rate_day';

  // Back-compat for older DB versions that only embed machine keys in message text.
  if (key.includes('interaction blocked between participants')) return 'interaction_blocked';
  if (key.includes('rate_limit:likes:hour')) return 'rate_hour';
  if (key.includes('rate_limit:likes:day')) return 'rate_day';
  return 'unknown';
}
