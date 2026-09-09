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
  /** Matches the Cyber-Sanctuary Stitch redesign's verified effective card radius (12px,
   * confirmed from the actual rendered code — not the design spec's inconsistent prose). Used
   * by Card's default tier so cards read consistently across all 5 themes, not just this one. */
  card: 12,
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

/** Per-theme font family override — every other theme keeps the platform's 'System' font (its
 * original look, unchanged); only cyberSanctuary swaps to Inter (loaded via @expo-google-fonts/
 * inter in app/_layout.tsx). Applied globally through a Text/TextInput defaultProps override in
 * ThemeProvider, since there's no shared Typography/Heading component every screen routes
 * through — see theme/ThemeProvider.tsx. */
export type FontFamilyTokens = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  extrabold: string;
};

const systemFontFamily: FontFamilyTokens = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
  extrabold: 'System',
};

const interFontFamily: FontFamilyTokens = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

export const THEME_FONT_FAMILY: Record<ThemeName, FontFamilyTokens> = {
  cyberpunk: systemFontFamily,
  minimalClean: systemFontFamily,
  cyberSanctuary: interFontFamily,
  sageCalm: systemFontFamily,
  aurora: systemFontFamily,
  roseQuartz: systemFontFamily,
  deepOcean: systemFontFamily,
  clarity: systemFontFamily,
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

/** "Cyber-Sanctuary" — a "Cyber-Professional" dark theme (cyan/purple/green tri-accent over a
 * tiered blue-grey base), adapted from a Stitch AI design export
 * (stitch_thematic_interface_redesign/cyber_sanctuary/DESIGN.md). Pairs with Inter (see
 * THEME_FONT_FAMILY above) for its "technical, highly legible" typography. */
export const cyberSanctuaryColors: ColorTokens = {
  background: '#090c13',
  surface: '#151a2a',
  surfaceElevated: '#1a2032',
  border: '#273047',
  textPrimary: '#eef3ff',
  textSecondary: '#8e98b5',
  textTertiary: '#859397',
  primary: '#89ebff',
  primaryMuted: 'rgba(33,211,238,0.16)',
  success: '#4bfa8f',
  successMuted: 'rgba(75,250,143,0.16)',
  warning: '#FFC145',
  warningMuted: 'rgba(255,193,69,0.16)',
  danger: '#ff3d7a',
  dangerMuted: 'rgba(255,61,122,0.16)',
  overlay: 'rgba(9,12,19,0.75)',
  moduleHabits: '#d5baff',
  moduleHabitsMuted: 'rgba(213,186,255,0.16)',
  moduleTasks: '#89ebff',
  moduleTasksMuted: 'rgba(137,235,255,0.16)',
  moduleJournal: '#4bfa8f',
  moduleJournalMuted: 'rgba(75,250,143,0.16)',
  glow: '#89ebff',
};

/** Light, warm, earthy — a second light option alongside minimalClean's crisp indigo/white,
 * leaning into the app's wellness/mindfulness side (Habits, Journal, Meditation, Breathing)
 * rather than reading as a generic productivity-app light theme. */
export const sageCalmColors: ColorTokens = {
  background: '#F6F5F0',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#DDE3D9',
  textPrimary: '#2B3328',
  textSecondary: '#5C6B57',
  textTertiary: '#8B9686',
  primary: '#6B8F71',
  primaryMuted: '#E7EFE6',
  success: '#4C9A6A',
  successMuted: '#E3F3E8',
  warning: '#D98E3B',
  warningMuted: '#FBEEDD',
  danger: '#C4614F',
  dangerMuted: '#FBE7E3',
  overlay: 'rgba(43,51,40,0.35)',
  moduleHabits: '#6B8F71',
  moduleHabitsMuted: '#E7EFE6',
  moduleTasks: '#4E80A3',
  moduleTasksMuted: '#E4EEF5',
  moduleJournal: '#B08968',
  moduleJournalMuted: '#F3E9E1',
  glow: '#9FC2A6',
};

/** Dark, teal/purple/pink over deep navy — softer and cooler than cyberpunk's high-saturation
 * neon, closer to an actual aurora borealis than a cyberpunk-city palette. */
export const auroraColors: ColorTokens = {
  background: '#0A1420',
  surface: '#0F1E2E',
  surfaceElevated: '#152B3F',
  border: 'rgba(120,255,214,0.14)',
  textPrimary: '#EAFBF6',
  textSecondary: '#93B8C4',
  textTertiary: '#5F7C87',
  primary: '#5EEAD4',
  primaryMuted: 'rgba(94,234,212,0.16)',
  success: '#86EFAC',
  successMuted: 'rgba(134,239,172,0.16)',
  warning: '#FDE68A',
  warningMuted: 'rgba(253,230,138,0.16)',
  danger: '#F472B6',
  dangerMuted: 'rgba(244,114,182,0.16)',
  overlay: 'rgba(5,10,16,0.75)',
  moduleHabits: '#C084FC',
  moduleHabitsMuted: 'rgba(192,132,252,0.16)',
  moduleTasks: '#5EEAD4',
  moduleTasksMuted: 'rgba(94,234,212,0.16)',
  moduleJournal: '#F472B6',
  moduleJournalMuted: 'rgba(244,114,182,0.16)',
  glow: '#5EEAD4',
};

/** Light, warm rose/coral accents on a cream base — a softer, more social/celebratory light
 * option than minimalClean's crisp indigo or sageCalm's earthy green. */
export const roseQuartzColors: ColorTokens = {
  background: '#FFF7F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#F3DCD8',
  textPrimary: '#3A2A28',
  textSecondary: '#8A6F6B',
  textTertiary: '#B79490',
  primary: '#E8837E',
  primaryMuted: '#FCE7E5',
  success: '#5FAE82',
  successMuted: '#E5F4EB',
  warning: '#E0A24B',
  warningMuted: '#FBEEDD',
  danger: '#D65F5F',
  dangerMuted: '#FBE4E4',
  overlay: 'rgba(58,42,40,0.35)',
  moduleHabits: '#E8837E',
  moduleHabitsMuted: '#FCE7E5',
  moduleTasks: '#8AA6C2',
  moduleTasksMuted: '#E7EEF5',
  moduleJournal: '#C9A15A',
  moduleJournalMuted: '#F5EBDA',
  glow: '#F2A6A1',
};

/** Dark, cool blue/indigo base — a calmer, more "professional" dark option than cyberpunk's
 * high-saturation neon, closer to open water than a neon skyline. */
export const deepOceanColors: ColorTokens = {
  background: '#050B14',
  surface: '#0B1420',
  surfaceElevated: '#122031',
  border: 'rgba(94,163,255,0.14)',
  textPrimary: '#EAF2FF',
  textSecondary: '#8FA6C4',
  textTertiary: '#5C7191',
  primary: '#3B82F6',
  primaryMuted: 'rgba(59,130,246,0.16)',
  success: '#34D399',
  successMuted: 'rgba(52,211,153,0.16)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251,191,36,0.16)',
  danger: '#F87171',
  dangerMuted: 'rgba(248,113,113,0.16)',
  overlay: 'rgba(2,6,12,0.75)',
  moduleHabits: '#818CF8',
  moduleHabitsMuted: 'rgba(129,140,248,0.16)',
  moduleTasks: '#3B82F6',
  moduleTasksMuted: 'rgba(59,130,246,0.16)',
  moduleJournal: '#34D399',
  moduleJournalMuted: 'rgba(52,211,153,0.16)',
  glow: '#3B82F6',
};

/** Dark, cool slate base — every other theme pairs a green-ish success with a red/pink danger,
 * which reads as the same color to red-green colorblind users (deuteranopia/protanopia, the two
 * most common forms). Clarity swaps that pairing for blue (success) vs orange (danger) — a
 * standard colorblind-safe substitution — with warning kept a third, distinct yellow so all three
 * status colors differ in both hue and luminance, not just hue. */
export const clarityColors: ColorTokens = {
  background: '#0A0E14',
  surface: '#10151D',
  surfaceElevated: '#161C27',
  border: 'rgba(148,163,184,0.16)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  primary: '#818CF8',
  primaryMuted: 'rgba(129,140,248,0.16)',
  success: '#38BDF8',
  successMuted: 'rgba(56,189,248,0.16)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251,191,36,0.16)',
  danger: '#F97316',
  dangerMuted: 'rgba(249,115,22,0.16)',
  overlay: 'rgba(4,6,10,0.75)',
  moduleHabits: '#818CF8',
  moduleHabitsMuted: 'rgba(129,140,248,0.16)',
  moduleTasks: '#38BDF8',
  moduleTasksMuted: 'rgba(56,189,248,0.16)',
  moduleJournal: '#FBBF24',
  moduleJournalMuted: 'rgba(251,191,36,0.16)',
  glow: '#818CF8',
};

export type ThemeName =
  | 'cyberpunk'
  | 'minimalClean'
  | 'cyberSanctuary'
  | 'sageCalm'
  | 'aurora'
  | 'roseQuartz'
  | 'deepOcean'
  | 'clarity';

export const THEME_COLORS: Record<ThemeName, ColorTokens> = {
  cyberpunk: cyberpunkColors,
  minimalClean: minimalCleanColors,
  cyberSanctuary: cyberSanctuaryColors,
  sageCalm: sageCalmColors,
  aurora: auroraColors,
  roseQuartz: roseQuartzColors,
  deepOcean: deepOceanColors,
  clarity: clarityColors,
};

export const THEME_LABELS: Record<ThemeName, string> = {
  cyberpunk: 'Cyberpunk Neon',
  minimalClean: 'Minimal Clean',
  cyberSanctuary: 'Cyber Sanctuary',
  sageCalm: 'Sage Calm',
  aurora: 'Aurora',
  roseQuartz: 'Rose Quartz',
  deepOcean: 'Deep Ocean',
  clarity: 'Clarity',
};

/** The theme each OS appearance setting starts a fresh install on — still overridable afterward
 * via Settings, this is only the one-time default. */
export const DEFAULT_THEME_FOR_SCHEME: Record<'light' | 'dark', ThemeName> = {
  light: 'minimalClean',
  dark: 'cyberpunk',
};
