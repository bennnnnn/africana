/**
 * Central logging: dev → console; prod → console.error only (extend with PostHog `$exception` if needed).
 */
import { track } from '@/lib/analytics';

export function logWarn(message: string, detail?: unknown): void {
  console.warn(message, detail ?? '');
}

export function logError(message: string, detail?: unknown): void {
  console.error(message, detail ?? '');
  if (!__DEV__ && detail instanceof Error) {
    track('client_error', { message: detail.message, name: detail.name });
  }
}
