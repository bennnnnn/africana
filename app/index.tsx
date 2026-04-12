import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { COLORS } from '@/constants';
import { isProfileCompleteForDiscover, onboardingHrefFromSession } from '@/lib/profile-completion';

export default function Index() {
  const { session, user, isInitialized } = useAuthStore();

  // Wait for the initial getSession() + profile fetch to resolve before routing.
  // Without this, the Zustand store starts with session=null on every
  // Expo restart and immediately redirects to welcome — logging the user out.
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!isProfileCompleteForDiscover(user)) {
    return <Redirect href={onboardingHrefFromSession(session)} />;
  }

  return <Redirect href="/(tabs)/discover" />;
}
