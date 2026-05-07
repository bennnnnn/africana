import * as Sentry from '@sentry/react-native';

const RAW_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const DSN = RAW_DSN && RAW_DSN.trim().length > 0 ? RAW_DSN.trim() : undefined;

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  if (!DSN) {
    if (__DEV__) {
      // Keep dev console quiet; missing DSN should be normal locally.
      console.info('[sentry] EXPO_PUBLIC_SENTRY_DSN not set; Sentry disabled.');
    }
    return;
  }

  Sentry.init({
    dsn: DSN,
    enableNative: true,
    enableNativeFramesTracking: true,
    enableAutoSessionTracking: true,
    // Avoid accidentally collecting PII (message contents, emails, etc.)
    sendDefaultPii: false,
    // In dev we still want logs; in prod sample a small amount of performance.
    tracesSampleRate: __DEV__ ? 0 : 0.1,
  });
}

export function setSentryUser(id: string | null): void {
  // Never send email/name for a dating app; id only.
  Sentry.setUser(id ? { id } : null);
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(err, { extra: context });
}

