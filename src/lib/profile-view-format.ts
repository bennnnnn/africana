import { formatLastActiveLabel } from '@/lib/utils';

/** Relative activity label for profile activity row (offline users only). */
export function formatShortLastSeenLabel(
  lastSeen: string | null | undefined,
  useLastActiveLabel: boolean,
): string | null {
  if (!useLastActiveLabel) return null;
  return formatLastActiveLabel(lastSeen);
}
