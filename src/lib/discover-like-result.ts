import { appDialog } from '@/lib/app-dialog';
import { showFreeLimitDialog } from '@/lib/free-quota';
import { UI_TOAST } from '@/constants/copy';
import { track, EVENTS } from '@/lib/analytics';

export type LikeToggleFailureReason =
  | 'blocked'
  | 'free_limit'
  | 'rate_hour'
  | 'rate_day'
  | 'error';

export type LikeToggleResult =
  | { ok: true; matched: boolean }
  | {
      ok: false;
      reason: LikeToggleFailureReason;
      message?: string;
      freeLimitCap?: number;
    };

export function showLikeToggleFailure(result: Extract<LikeToggleResult, { ok: false }>): void {
  switch (result.reason) {
    case 'blocked':
      appDialog({
        title: 'Can\u2019t send like',
        message: UI_TOAST.interactionBlocked,
        icon: 'ban-outline',
      });
      break;
    case 'free_limit':
      showFreeLimitDialog('likes', result.freeLimitCap ?? 0);
      break;
    case 'rate_hour':
      track(EVENTS.RATE_LIMIT_HIT, { topic: 'likes', window: 'hour' });
      appDialog({
        title: 'Slow down',
        message: 'You\u2019re liking too fast. Take a breather and try again in a bit.',
        icon: 'time-outline',
      });
      break;
    case 'rate_day':
      track(EVENTS.RATE_LIMIT_HIT, { topic: 'likes', window: 'day' });
      appDialog({
        title: 'Daily like limit reached',
        message:
          'You\u2019ve reached today\u2019s like limit. Come back tomorrow or upgrade for more.',
        icon: 'heart-dislike-outline',
      });
      break;
    default:
      appDialog({
        title: 'Like failed',
        message: result.message ?? "Couldn't send your like. Try again.",
        icon: 'alert-circle-outline',
      });
  }
}
