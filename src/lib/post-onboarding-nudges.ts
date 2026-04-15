import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@africana/onboarding_skipped_hints';

export type SkippedOnboardingHints = {
  bio: boolean;
  photo: boolean;
  goals: boolean;
  work: boolean;
  moreDetails: boolean;
};

export async function saveOnboardingSkippedHints(hints: SkippedOnboardingHints): Promise<void> {
  const any = hints.bio || hints.photo || hints.goals || hints.work || hints.moreDetails;
  if (!any) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hints));
}

export async function loadOnboardingSkippedHints(): Promise<SkippedOnboardingHints | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SkippedOnboardingHints;
    if (
      typeof parsed.bio !== 'boolean' ||
      typeof parsed.photo !== 'boolean' ||
      typeof parsed.goals !== 'boolean' ||
      typeof parsed.work !== 'boolean' ||
      typeof parsed.moreDetails !== 'boolean'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearOnboardingSkippedHints(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
