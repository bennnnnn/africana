import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';

dayjs.extend(isToday);
dayjs.extend(isYesterday);

/** Header line when the other person is offline and shares last seen (Telegram-style). */
export function formatChatLastSeen(iso: string): string {
  const d = dayjs(iso);
  if (!d.isValid()) return 'a while ago';
  if (d.isToday()) return `today at ${d.format('h:mm A')}`;
  if (d.isYesterday()) return `yesterday at ${d.format('h:mm A')}`;
  if (dayjs().diff(d, 'day') < 7) return `${d.format('ddd')} at ${d.format('h:mm A')}`;
  return d.format('MMM D, YYYY [at] h:mm A');
}
