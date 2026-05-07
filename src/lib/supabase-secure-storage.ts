import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Supabase Auth session JSON often exceeds iOS SecureStore's per-key limit (~2048 bytes).
 * Chunk across multiple SecureStore keys, with a one-time read-through from AsyncStorage
 * for sessions written before this adapter shipped.
 */
const CHUNK_SIZE = 1900;
const CHUNK_COUNT_SUFFIX = '__sb_chunk_count';
const chunkKey = (base: string, i: number) => `${base}__sb_part_${i}`;

async function readChunks(key: string): Promise<string | null> {
  const nStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
  if (nStr == null) return null;
  const n = parseInt(nStr, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  let out = '';
  for (let i = 0; i < n; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) return null;
    out += part;
  }
  return out;
}

async function clearChunks(key: string): Promise<void> {
  const nStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
  await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX).catch(() => {});
  if (nStr != null) {
    const n = parseInt(nStr, 10);
    if (Number.isFinite(n) && n > 0) {
      for (let i = 0; i < n; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {});
      }
    }
  }
}

export const supabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    try {
      const chunked = await readChunks(key);
      if (chunked != null) return chunked;

      const single = await SecureStore.getItemAsync(key);
      if (single != null) return single;

      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        await supabaseAuthStorage.setItem(key, legacy);
        await AsyncStorage.removeItem(key);
      }
      return legacy;
    } catch {
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key).catch(() => {});

    const n = Math.ceil(value.length / CHUNK_SIZE) || 1;
    if (n === 1) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await SecureStore.setItemAsync(key + CHUNK_COUNT_SUFFIX, String(n));
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    if (Platform.OS === 'web') return;
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};
