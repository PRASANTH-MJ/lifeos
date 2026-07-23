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

const palette = {
  purple: '#6C63FF',
  purpleMuted: '#EDECFF',
  blue: '#3D8BFF',
  blueMuted: '#E7F1FF',
  amber: '#F5A623',
  amberMuted: '#FCEFD9',
  green: '#34C759',
  greenMuted: '#E4F8EA',
  red: '#FF3B30',
  redMuted: '#FFE7E5',
  gray: {
    50: '#F9FAFB',
    100: '#F1F2F4',
    200: '#E4E6EA',
    300: '#D3D6DB',
    400: '#9AA0AC',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2430',
    900: '#14171F',
    950: '#0B0D12',
  },
};

export const lightColors = {
  background: palette.gray[50],
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: palette.gray[200],
  textPrimary: palette.gray[900],
  textSecondary: palette.gray[600],
  textTertiary: palette.gray[400],
  primary: palette.purple,
  primaryMuted: palette.purpleMuted,
  success: palette.green,
  successMuted: palette.greenMuted,
  warning: palette.amber,
  warningMuted: palette.amberMuted,
  danger: palette.red,
  dangerMuted: palette.redMuted,
  overlay: 'rgba(11,13,18,0.4)',
  moduleHabits: palette.purple,
  moduleHabitsMuted: palette.purpleMuted,
  moduleTasks: palette.blue,
  moduleTasksMuted: palette.blueMuted,
  moduleJournal: palette.amber,
  moduleJournalMuted: palette.amberMuted,
};

export const darkColors = {
  background: palette.gray[950],
  surface: palette.gray[900],
  surfaceElevated: palette.gray[800],
  border: palette.gray[700],
  textPrimary: '#F5F6F8',
  textSecondary: palette.gray[400],
  textTertiary: palette.gray[500],
  primary: '#8C85FF',
  primaryMuted: 'rgba(140,133,255,0.16)',
  success: '#3DDB6C',
  successMuted: 'rgba(61,219,108,0.16)',
  warning: '#F7B94D',
  warningMuted: 'rgba(247,185,77,0.16)',
  danger: '#FF6259',
  dangerMuted: 'rgba(255,98,89,0.16)',
  overlay: 'rgba(0,0,0,0.6)',
  moduleHabits: '#8C85FF',
  moduleHabitsMuted: 'rgba(140,133,255,0.16)',
  moduleTasks: '#6BA8FF',
  moduleTasksMuted: 'rgba(107,168,255,0.16)',
  moduleJournal: '#F7B94D',
  moduleJournalMuted: 'rgba(247,185,77,0.16)',
};

export type ColorTokens = typeof lightColors;
