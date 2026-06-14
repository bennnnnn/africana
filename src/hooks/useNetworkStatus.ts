import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';

// Lightweight 204-response endpoint — no native module required.
const CHECK_URL = 'https://connectivitycheck.gstatic.com/generate_204';
const TIMEOUT_MS = 5000;

async function checkInternet(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(CHECK_URL, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.status < 400;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    const connected = await checkInternet();
    setIsOnline(connected);
    return connected;
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
