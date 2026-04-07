import React, { createContext, useContext, useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { darkColors, lightColors, ThemeColors } from '@/theme/palette';
import type { ThemePreference } from '@/types';

export type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;
  resolved: ResolvedTheme;
  preference: ThemePreference;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference: ThemePreference = useAuthStore((s) => s.settings?.theme ?? 'light');
  const resolved: ResolvedTheme = preference === 'dark' ? 'dark' : 'light';
  const colors = resolved === 'dark' ? darkColors : lightColors;

  const value = useMemo(() => ({ colors, resolved, preference }), [colors, resolved, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
