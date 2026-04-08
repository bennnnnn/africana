import AsyncStorage from '@react-native-async-storage/async-storage';

function getStorageKey(userId: string, conversationId: string): string {
  return `hidden-messages:${userId}:${conversationId}`;
}

export async function getHiddenMessageIds(
  userId: string,
  conversationId: string,
): Promise<Set<string>> {
  if (!userId || !conversationId) return new Set();
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId, conversationId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

export async function persistHiddenMessageIds(
  userId: string,
  conversationId: string,
  hiddenIds: Set<string>,
): Promise<void> {
  if (!userId || !conversationId) return;
  try {
    await AsyncStorage.setItem(
      getStorageKey(userId, conversationId),
      JSON.stringify([...hiddenIds]),
    );
  } catch {}
}
