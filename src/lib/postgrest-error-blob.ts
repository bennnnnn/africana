/** Normalized text blob for substring checks on PostgREST / Postgres errors. */
export function pgErrorBlob(err: { message?: string; details?: string; hint?: string } | null): string {
  if (!err) return '';
  return `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`.toLowerCase();
}

/**
 * Stable discriminator for Postgres errors exposed via PostgREST.
 *
 * Prefer checking `details` (set by `RAISE EXCEPTION USING DETAIL = ...`) over the
 * human-facing message. Falls back to extracting a leading machine key from
 * message strings like `rate_limit:messages:hour:% ...`.
 */
export function pgErrorDiscriminator(
  err: { code?: string; message?: string; details?: string } | null,
): { code?: string; key: string } {
  if (!err) return { code: undefined, key: '' };
  const detailsKey = (err.details ?? '').trim().toLowerCase();
  if (detailsKey) return { code: err.code, key: detailsKey };
  const msg = (err.message ?? '').trim().toLowerCase();
  if (!msg) return { code: err.code, key: '' };
  const key = msg.includes(':%') ? msg.split(':%', 1)[0]!.trim() : msg;
  return { code: err.code, key };
}

export type PostgrestErrorFields = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};
