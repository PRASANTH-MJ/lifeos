export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

// iOS reads shadow*; Android reads elevation — both are safe to set together,
// each platform just ignores the props it doesn't use.
export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const typography = {
  family: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 34,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

/**
 * Every screen/component reads colors exclusively through this shape via useAppTheme() — adding
 * a theme is just adding one more object below that satisfies it, no call-site changes needed
 * anywhere else. `glow` is the one new field: the color components/GlowSurface.tsx layers to fake
 * an ambient glow (Android has no native colored-shadow/blur support, so every "glow" and "glass"
 * effect in this app is a layered-color approximation, not a real blur — see the redesign plan).
 */
export type ColorTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  overlay: string;
  moduleHabits: string;
  moduleHabitsMuted: string;
  moduleTasks: string;
  moduleTasksMuted: string;
  moduleJournal: string;
  moduleJournalMuted: string;
  glow: string;
};

/** Dark default — deep obsidian base, vibrant cyan/violet/neon-green accents. */
export const cyberpunkColors: ColorTokens = {
  background: '#0D0F17',
  surface: '#12151F',
  surfaceElevated: '#191D2B',
  border: 'rgba(140,255,234,0.14)',
  textPrimary: '#F2F6FF',
  textSecondary: '#9AA6C4',
  textTertiary: '#626E8C',
  primary: '#22D3EE',
  primaryMuted: 'rgba(34,211,238,0.16)',
  success: '#39FF88',
  successMuted: 'rgba(57,255,136,0.16)',
  warning: '#FFC145',
  warningMuted: 'rgba(255,193,69,0.16)',
  danger: '#FF3D71',
  dangerMuted: 'rgba(255,61,113,0.16)',
  overlay: 'rgba(3,4,8,0.75)',
  moduleHabits: '#A855F7',
  moduleHabitsMuted: 'rgba(168,85,247,0.16)',
  moduleTasks: '#22D3EE',
  moduleTasksMuted: 'rgba(34,211,238,0.16)',
  moduleJournal: '#39FF88',
  moduleJournalMuted: 'rgba(57,255,136,0.16)',
  glow: '#22D3EE',
};

/** OLED-friendly pure black, kept deliberately restrained — only violet/white highlights. */
export const midnightGlassColors: ColorTokens = {
  background: '#000000',
  surface: '#0A0A0D',
  surfaceElevated: '#14141A',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textTertiary: 'rgba(255,255,255,0.38)',
  primary: '#A78BFA',
  primaryMuted: 'rgba(167,139,250,0.14)',
  success: '#6EE7B7',
  successMuted: 'rgba(110,231,183,0.14)',
  warning: '#FCD34D',
  warningMuted: 'rgba(252,211,77,0.14)',
  danger: '#F87171',
  dangerMuted: 'rgba(248,113,113,0.14)',
  overlay: 'rgba(0,0,0,0.8)',
  moduleHabits: '#A78BFA',
  moduleHabitsMuted: 'rgba(167,139,250,0.14)',
  moduleTasks: '#C4B5FD',
  moduleTasksMuted: 'rgba(196,181,253,0.14)',
  moduleJournal: '#E5E7EB',
  moduleJournalMuted: 'rgba(229,231,235,0.12)',
  glow: '#A78BFA',
};

/** Light default — crisp off-white, soft indigo/lavender accents. Glow is used sparingly here;
 * a bright neon glow reads as a mistake on a light background, not a feature. */
export const minimalCleanColors: ColorTokens = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  primary: '#6366F1',
  primaryMuted: '#EEF0FF',
  success: '#22C55E',
  successMuted: '#E7F9EE',
  warning: '#F59E0B',
  warningMuted: '#FEF3DE',
  danger: '#EF4444',
  dangerMuted: '#FDE8E8',
  overlay: 'rgba(30,41,59,0.35)',
  moduleHabits: '#6366F1',
  moduleHabitsMuted: '#EEF0FF',
  moduleTasks: '#3B82F6',
  moduleTasksMuted: '#E7F1FF',
  moduleJournal: '#F59E0B',
  moduleJournalMuted: '#FEF3DE',
  glow: '#A5B4FC',
};

/** Dark bronze/slate base, glowing warm amber and gold accents. */
export const solarFlareColors: ColorTokens = {
  background: '#1C1410',
  surface: '#241A13',
  surfaceElevated: '#2E2117',
  border: 'rgba(245,166,35,0.16)',
  textPrimary: '#FBEEDD',
  textSecondary: '#C9A788',
  textTertiary: '#8C7160',
  primary: '#FFB020',
  primaryMuted: 'rgba(255,176,32,0.18)',
  success: '#7CD992',
  successMuted: 'rgba(124,217,146,0.16)',
  warning: '#FFA726',
  warningMuted: 'rgba(255,167,38,0.16)',
  danger: '#FF6B4A',
  dangerMuted: 'rgba(255,107,74,0.16)',
  overlay: 'rgba(20,12,6,0.75)',
  moduleHabits: '#FFB020',
  moduleHabitsMuted: 'rgba(255,176,32,0.18)',
  moduleTasks: '#FF8C42',
  moduleTasksMuted: 'rgba(255,140,66,0.16)',
  moduleJournal: '#FFD166',
  moduleJournalMuted: 'rgba(255,209,102,0.16)',
  glow: '#FFB020',
};

export type ThemeName = 'cyberpunk' | 'midnightGlass' | 'minimalClean' | 'solarFlare';

export const THEME_COLORS: Record<ThemeName, ColorTokens> = {
  cyberpunk: cyberpunkColors,
  midnightGlass: midnightGlassColors,
  minimalClean: minimalCleanColors,
  solarFlare: solarFlareColors,
};

export const THEME_LABELS: Record<ThemeName, string> = {
  cyberpunk: 'Cyberpunk Neon',
  midnightGlass: 'Midnight Glass',
  minimalClean: 'Minimal Clean',
  solarFlare: 'Solar Flare',
};

/** The theme each OS appearance setting starts a fresh install on — still overridable afterward
 * via Settings, this is only the one-time default. */
export const DEFAULT_THEME_FOR_SCHEME: Record<'light' | 'dark', ThemeName> = {
  light: 'minimalClean',
  dark: 'cyberpunk',
};
