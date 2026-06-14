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
import { Text, TextInput } from 'react-native';
import { useAuthStore } from '@/store/auth.store';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DialogProvider } from '@/components/ui/DialogProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { useRootLayoutBootstrap } from '@/hooks/use-root-layout-bootstrap';
import { logError } from '@/lib/logger';

// ─── Global crash reporting ───────────────────────────────────────────────────
// Catch uncaught errors and log them via the central logger.
// React error boundaries handle render-time errors; this catches everything else
// (timeout callbacks, event handlers outside the component tree, etc.).
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler?.() ?? undefined;
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logError('Uncaught error', { message: error.message, name: error.name, fatal: isFatal });
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Disable font scaling on all Text and TextInput elements globally to prevent
// system-level accessibility font size overrides from breaking the app layout.
// We cast through any because React 19 removed defaultProps from host component types,
// but the runtime setter still works in RN 0.85.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Text as any).defaultProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...((Text as any).defaultProps as Record<string, unknown>),
  allowFontScaling: false,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(TextInput as any).defaultProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...((TextInput as any).defaultProps as Record<string, unknown>),
  allowFontScaling: false,
};

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
              <NetworkBanner />
              <ErrorBoundary>
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
            </ErrorBoundary>
          </DialogProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
