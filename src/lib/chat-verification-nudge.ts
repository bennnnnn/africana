import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@africana/chat_verification_nudge_seen';

export async function loadChatVerificationNudgeSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw === '1';
}

export async function markChatVerificationNudgeSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, '1');
}
