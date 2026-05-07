import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
// Native keyboard inset provider. This is the only reliable way to handle
// keyboard insets on Android edge-to-edge across OEMs (Samsung, MIUI,
// ColorOS, etc.) — it reads insets from `WindowInsetsCompat` natively
// instead of guessing them from JS-side keyboard events. Bundled in Expo
// Go SDK 54+, so no dev build required.
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useAuthStore } from '@/store/auth.store';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DialogProvider } from '@/components/ui/DialogProvider';
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { useRootLayoutBootstrap } from '@/hooks/use-root-layout-bootstrap';

export default function RootLayout() {
  const { setSession, hydrateUserFromServer, setInitialized } = useAuthStore(
    useShallow((s) => ({
      setSession: s.setSession,
      hydrateUserFromServer: s.hydrateUserFromServer,
      setInitialized: s.setInitialized,
    })),
  );
  const router = useRouter();
  const [fontsLoaded] = useFonts({ DMSerifDisplay_400Regular });
  useRootLayoutBootstrap({
    router,
    fontsLoaded,
    setInitialized,
    setSession,
    hydrateUserFromServer,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <DialogProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="(profile)"
                options={{
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen name="(chat)" />
              <Stack.Screen name="(settings)" />
            </Stack>
          </DialogProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
