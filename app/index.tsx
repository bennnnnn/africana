import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export default function Index() {
  const { session } = useAuthStore();
  return <Redirect href={session ? '/(tabs)/discover' : '/(auth)/welcome'} />;
}
