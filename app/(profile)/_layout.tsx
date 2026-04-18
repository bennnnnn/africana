import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Profile → Profile transitions (pull-up for next, gallery prev/next)
        // slide up from the bottom so they feel like a fresh detail sheet
        // rather than a sideways page turn. The Discover → Profile entrance
        // is owned by the root stack and stays as its default.
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
