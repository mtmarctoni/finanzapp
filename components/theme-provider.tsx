'use client';

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
  useTheme,
} from 'next-themes';
import { useEffect } from 'react';

function ThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // App preferences can differ from the phone's theme. Keep browser/PWA
    // chrome in sync with the actual canvas, including a saved preference.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        resolvedTheme === 'light' ? '#f2f2f7' : '#000000',
      );
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColor />
      {children}
    </NextThemesProvider>
  );
}
