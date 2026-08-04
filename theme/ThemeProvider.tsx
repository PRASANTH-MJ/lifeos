import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_THEME_FOR_SCHEME,
  radius,
  shadow,
  spacing,
  THEME_COLORS,
  typography,
  type ColorTokens,
  type ThemeName,
} from './tokens';

const STORAGE_KEY = 'lifeos-theme-name';

/** Cyberpunk/Midnight Glass/Solar Flare read as "dark" for anything that still needs a coarse
 * light/dark distinction (e.g. status bar style) without caring which of the 4 themes is active. */
const DARK_THEMES = new Set<ThemeName>(['cyberpunk', 'midnightGlass', 'solarFlare']);

export type AppTheme = {
  scheme: 'light' | 'dark';
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadow: typeof shadow;
};

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const osScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME_FOR_SCHEME[osScheme]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && stored in THEME_COLORS) setThemeNameState(stored as ThemeName);
    });
    // Only ever read once on mount — the OS-scheme default above already picked a sensible
    // starting point before this resolves, so there's nothing to react to afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setThemeName = (name: ThemeName) => {
    setThemeNameState(name);
    AsyncStorage.setItem(STORAGE_KEY, name).catch(() => {});
  };

  const theme = useMemo<AppTheme>(
    () => ({
      scheme: DARK_THEMES.has(themeName) ? 'dark' : 'light',
      themeName,
      setThemeName,
      colors: THEME_COLORS[themeName],
      spacing,
      radius,
      typography,
      shadow,
    }),
    [themeName]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return theme;
}
