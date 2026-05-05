import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import type { Message } from '@/types';

dayjs.extend(isToday);
dayjs.extend(isYesterday);

export type ChatListItem =
  | { type: 'message'; message: Message; isGroupStart: boolean; isGroupEnd: boolean }
  | { type: 'date'; id: string; label: string };

/** Consecutive messages from the same sender within this window group into a single "bubble stack". */
export const MESSAGE_GROUP_GAP_MS = 5 * 60 * 1000;

export function getChatDayKey(createdAt: string): string {
  return dayjs(createdAt).format('YYYY-MM-DD');
}

export function formatChatDateLabel(createdAt: string): string {
  const d = dayjs(createdAt);
  if (d.isToday()) return 'Today';
  if (d.isYesterday()) return 'Yesterday';
  return d.format('ddd, MMM D');
}

export function buildChatListItems(listData: Message[]): ChatListItem[] {
  const items: ChatListItem[] = [];
  let lastDayKey: string | null = null;
  for (let i = 0; i < listData.length; i++) {
    const message = listData[i];
    const prev = listData[i - 1];
    const next = listData[i + 1];
    const dayKey = getChatDayKey(message.created_at);
    if (dayKey !== lastDayKey) {
      items.push({
        type: 'date',
        id: `date-${dayKey}`,
        label: formatChatDateLabel(message.created_at),
      });
      lastDayKey = dayKey;
    }
    const ts = new Date(message.created_at).getTime();
    const prevSameGroup =
      !!prev &&
      prev.sender_id === message.sender_id &&
      getChatDayKey(prev.created_at) === dayKey &&
      ts - new Date(prev.created_at).getTime() < MESSAGE_GROUP_GAP_MS;
    const nextSameGroup =
      !!next &&
      next.sender_id === message.sender_id &&
      getChatDayKey(next.created_at) === dayKey &&
      new Date(next.created_at).getTime() - ts < MESSAGE_GROUP_GAP_MS;
    items.push({
      type: 'message',
      message,
      isGroupStart: !prevSameGroup,
      isGroupEnd: !nextSameGroup,
    });
  }
  return items;
}
