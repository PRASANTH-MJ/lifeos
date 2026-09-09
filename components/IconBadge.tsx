import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

type Size = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<Size, number> = { sm: 32, md: 40, lg: 48 };
const ICON_SIZE: Record<Size, number> = { sm: 16, md: 20, lg: 24 };

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  /** Tints both the background (at low opacity) and the icon itself. Defaults to the active
   * theme's primary color — pass a module color (theme.colors.moduleHabits, etc.) or a semantic
   * one (success/warning/danger) to match what the icon represents. */
  color?: string;
  size?: Size;
  /** 'tinted' (default) — a colored, low-opacity background behind the icon, matching the
   * accent-tinted icon badges used throughout the Cyber-Sanctuary list-row/card patterns.
   * 'neutral' — a plain surface-toned background, for icons that aren't meant to draw the eye
   * (e.g. a bank icon in an account row) rather than every icon competing for attention. */
  tone?: 'tinted' | 'neutral';
  /** 'circle' (default, matches most list-row leading icons) or 'square' (rounded-square,
   * matches the larger dashboard/card icon badges in the mockups). */
  shape?: 'circle' | 'square';
};

export function IconBadge({ name, color, size = 'md', tone = 'tinted', shape = 'circle' }: Props) {
  const theme = useAppTheme();
  const tint = color ?? theme.colors.primary;
  const box = SIZE_PX[size];

  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: shape === 'circle' ? box / 2 : theme.radius.md,
        backgroundColor: tone === 'tinted' ? withAlpha(tint, 0.16) : theme.colors.surfaceElevated,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tone === 'tinted' ? withAlpha(tint, 0.28) : theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={name} size={ICON_SIZE[size]} color={tone === 'tinted' ? tint : theme.colors.textSecondary} />
    </View>
  );
}
