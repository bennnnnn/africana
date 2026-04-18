import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types';

/**
 * In-memory + on-disk cache of `User` rows that list screens already have loaded.
 *
 * - Callers write a seed *just before* pushing to `/(profile)/[id]`, and the
 *   profile screen reads it synchronously on mount so it can paint instantly
 *   instead of showing a spinner while Supabase rehydrates the row.
 * - The screen still does a silent background refresh, so stale data is
 *   replaced within a few hundred ms.
 * - The in-memory `Map` is mirrored to AsyncStorage (debounced, fire-and-forget)
 *   so the "instant open" benefit also applies to cold starts: when the app
 *   relaunches we hydrate the Map from disk before any list screen renders.
 *
 * Capacity / TTL keep disk usage bounded:
 *   - MAX_ENTRIES (LRU eviction by `savedAt`)
 *   - MAX_AGE_MS  (entries older than this are dropped on hydrate / read)
 */

const STORAGE_KEY = 'africana:profile-seed-cache:v1';
const MAX_ENTRIES = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FLUSH_DEBOUNCE_MS = 400;

type Entry = { user: User; savedAt: number };

const cache = new Map<string, Entry>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushChain: Promise<unknown> = Promise.resolve();

function isFresh(entry: Entry): boolean {
  return Date.now() - entry.savedAt < MAX_AGE_MS;
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushChain = flushChain.then(persistNow, persistNow);
  }, FLUSH_DEBOUNCE_MS);
}

async function persistNow(): Promise<void> {
  try {
    // Trim to MAX_ENTRIES, keeping the most recently seeded.
    if (cache.size > MAX_ENTRIES) {
      const entries = Array.from(cache.entries()).sort(
        (a, b) => b[1].savedAt - a[1].savedAt,
      );
      cache.clear();
      for (const [id, entry] of entries.slice(0, MAX_ENTRIES)) {
        cache.set(id, entry);
      }
    }
    const payload: Record<string, Entry> = {};
    for (const [id, entry] of cache) payload[id] = entry;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    if (__DEV__) console.warn('[profile-seed-cache] persist failed', e);
  }
}

/**
 * Load the cache from disk into memory. Safe to call multiple times — only
 * runs once. Should be called as early as possible (root layout effect) so the
 * synchronous `getProfileSeed` reads in `useState(...)` initializers see the
 * persisted entries on cold start.
 */
export function hydrateProfileSeedCache(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, Entry>;
        for (const [id, entry] of Object.entries(parsed)) {
          if (entry?.user?.id && typeof entry.savedAt === 'number' && isFresh(entry)) {
            cache.set(id, entry);
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[profile-seed-cache] hydrate failed', e);
    } finally {
      hydrated = true;
    }
  })();
  return hydratePromise;
}

export function setProfileSeed(user: User | null | undefined): void {
  if (!user?.id) return;
  cache.set(user.id, { user, savedAt: Date.now() });
  scheduleFlush();
}

export function getProfileSeed(userId: string | null | undefined): User | null {
  if (!userId) return null;
  const entry = cache.get(userId);
  if (!entry) return null;
  if (!isFresh(entry)) {
    cache.delete(userId);
    scheduleFlush();
    return null;
  }
  return entry.user;
}

export function clearProfileSeed(userId: string): void {
  if (cache.delete(userId)) scheduleFlush();
}

export async function clearProfileSeedCache(): Promise<void> {
  cache.clear();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    if (__DEV__) console.warn('[profile-seed-cache] clear failed', e);
  }
}
