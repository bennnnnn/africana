import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

/**
 * Returns the current online status and a function to manually re-check.
 * Uses expo-network (bundled in Expo Go) instead of @react-native-community/netinfo
 * which requires a native build to link its native module.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const state = await Network.getNetworkStateAsync();
      const connected = state.isConnected ?? true;
      setIsOnline(connected);
      return connected;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    void checkConnection();

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void checkConnection();
    });

    return () => sub.remove();
  }, [checkConnection]);

  return { isOnline, checkConnection };
}
