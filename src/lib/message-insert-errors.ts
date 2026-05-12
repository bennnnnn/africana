import { UI_TOAST } from '@/constants/copy';
import {
  pgErrorDiscriminator,
  pgErrorBlob,
  type PostgrestErrorFields,
} from '@/lib/postgrest-error-blob';

/** Shown to the sender when the recipient has turned off receiving messages. */
export const ERROR_RECIPIENT_MESSAGES_DISABLED =
  'This person has turned off receiving messages in their settings.';

/** Shown when your own Receive messages is off (nothing in or out until you turn it on). */
export const ERROR_SENDER_MESSAGES_DISABLED =
  'Your messages are turned off. Open Settings → Privacy and turn on Receive messages to send.';

export const ERROR_MESSAGE_MODERATION = 'This message looks inappropriate. Please rephrase it.';

export const ERROR_MESSAGE_RATE_LIMIT_HOUR =
  'You\u2019re sending messages too fast. Please wait a bit and try again.';
export const ERROR_MESSAGE_RATE_LIMIT_DAY =
  'You\u2019ve reached today\u2019s message limit. Please try again tomorrow.';

/** Free-tier daily cap reached. The `showFreeLimitDialog` already presented;
 *  return this sentinel so callers can bail without showing a second error. */
export const ERROR_MESSAGE_FREE_LIMIT = 'free_limit_reached';

export const ERROR_MESSAGING_BLOCKED = UI_TOAST.openChatBlocked;

function isRecipientMessagesDisabledDbError(err: PostgrestErrorFields | null): boolean {
  const { code, key } = pgErrorDiscriminator(err);
  if (code === '23514' && key === 'recipient_messages_disabled') return true;
  const b = pgErrorBlob(err);
  return b.includes('recipient') && b.includes('not accept');
}

function isSenderMessagesDisabledDbError(err: PostgrestErrorFields | null): boolean {
  const { code, key } = pgErrorDiscriminator(err);
  if (code === '23514' && key === 'sender_messages_disabled') return true;
  const b = pgErrorBlob(err);
  return b.includes('sender') && b.includes('not accept');
}

function isMessagingBlockedDbError(err: PostgrestErrorFields | null): boolean {
  const { code, key } = pgErrorDiscriminator(err);
  if (code === '23514' && key === 'messaging_blocked_between_participants') return true;
  const b = pgErrorBlob(err);
  return b.includes('messaging blocked between participants');
}

/** Maps raw PostgREST errors so the UI never shows a vague insert failure for prefs guards. */
export function mapMessagesInsertError(err: PostgrestErrorFields | null): string | null {
  if (!err) return null;
  if (isMessagingBlockedDbError(err)) return ERROR_MESSAGING_BLOCKED;
  if (isRecipientMessagesDisabledDbError(err)) return ERROR_RECIPIENT_MESSAGES_DISABLED;
  if (isSenderMessagesDisabledDbError(err)) return ERROR_SENDER_MESSAGES_DISABLED;
  const { code, key } = pgErrorDiscriminator(err);
  if (code === '23P01' && key === 'rate_limit:messages:hour') return ERROR_MESSAGE_RATE_LIMIT_HOUR;
  if (code === '23P01' && key === 'rate_limit:messages:day') return ERROR_MESSAGE_RATE_LIMIT_DAY;
  const blob = pgErrorBlob(err);
  if (blob.includes('rate_limit:messages:hour')) return ERROR_MESSAGE_RATE_LIMIT_HOUR;
  if (blob.includes('rate_limit:messages:day')) return ERROR_MESSAGE_RATE_LIMIT_DAY;
  return null;
}
