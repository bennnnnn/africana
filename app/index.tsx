import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { COLORS } from '@/constants';

export default function Index() {
  const { session, isInitialized } = useAuthStore();

  // Wait for the initial getSession() to resolve before routing.
  // Without this, the Zustand store starts with session=null on every
  // Expo restart and immediately redirects to welcome — logging the user out.
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)/discover' : '/(auth)/welcome'} />;
}
