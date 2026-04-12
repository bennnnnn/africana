import React, { createContext, useContext, useMemo } from 'react';
import { lightColors, ThemeColors } from '@/theme/palette';

export type ResolvedTheme = 'light';

type ThemeContextValue = {
  colors: ThemeColors;
  resolved: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ colors: lightColors, resolved: 'light' as const }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
