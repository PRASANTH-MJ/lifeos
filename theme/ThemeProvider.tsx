import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Text, TextInput, useColorScheme } from 'react-native';

import {
  DEFAULT_THEME_FOR_SCHEME,
  radius,
  shadow,
  spacing,
  THEME_COLORS,
  THEME_FONT_FAMILY,
  typography,
  type ColorTokens,
  type FontFamilyTokens,
  type ThemeName,
} from './tokens';

const STORAGE_KEY = 'lifeos-theme-name';

/** Cyberpunk/Cyber Sanctuary/Aurora/Deep Ocean/Clarity read as "dark" for anything that still
 * needs a coarse light/dark distinction (e.g. status bar style) without caring which specific
 * theme is active. (Solar Flare and Midnight Glass were removed from the theme system.) */
const DARK_THEMES = new Set<ThemeName>(['cyberpunk', 'cyberSanctuary', 'aurora', 'deepOcean', 'clarity']);

/** No shared Typography/Heading component exists for every screen to route a font family
 * through (see theme/tokens.ts's THEME_FONT_FAMILY doc comment), so a theme's font is applied
 * globally the same way React Native apps conventionally do this: overriding Text/TextInput's
 * defaultProps. Re-applied every time the active theme changes so switching themes in Settings
 * takes effect immediately without a reload. Explicit `style.fontFamily` on any individual
 * component still wins over this default, same as any other defaultProps-supplied style. */
function applyGlobalFontFamily(fontFamily: FontFamilyTokens) {
  const style = { fontFamily: fontFamily.regular };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Text as any).defaultProps = { ...(Text as any).defaultProps, style: [(Text as any).defaultProps?.style, style] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, style: [(TextInput as any).defaultProps?.style, style] };
}

export type AppTheme = {
  scheme: 'light' | 'dark';
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  fontFamily: FontFamilyTokens;
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

  // Re-applied on every theme change (including the very first render) so switching themes in
  // Settings updates every already-mounted Text/TextInput's font immediately, no reload needed.
  useEffect(() => {
    applyGlobalFontFamily(THEME_FONT_FAMILY[themeName]);
  }, [themeName]);

  const theme = useMemo<AppTheme>(
    () => ({
      scheme: DARK_THEMES.has(themeName) ? 'dark' : 'light',
      themeName,
      setThemeName,
      colors: THEME_COLORS[themeName],
      spacing,
      radius,
      typography,
      fontFamily: THEME_FONT_FAMILY[themeName],
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
