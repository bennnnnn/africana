import { Stack } from 'expo-router';
import { COLORS } from '@/constants';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.surface },
        animation: 'slide_from_right',
      }}
    />
  );
}
