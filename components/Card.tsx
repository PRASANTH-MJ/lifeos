import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlowSurface } from './GlowSurface';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Wraps the card in an ambient GlowSurface halo in the active theme's glow color. */
  glow?: boolean;
  /** Translucent tinted surface instead of the normal opaque one — the "glassmorphism" look. */
  glass?: boolean;
  /** Which layer of the surface stack this card sits on — 'elevated' (default, unchanged from
   * before) for a card that should "pop forward" (the common case: most cards on a screen), or
   * 'panel' for a card meant to sit closer to the page background (a large section container
   * that itself holds smaller elevated rows/cards inside it — e.g. a "resting" section wrapper
   * rather than a single popped-forward card). */
  tier?: 'panel' | 'elevated';
};

export function Card({ children, style, glow, glass, tier = 'elevated' }: Props) {
  const theme = useAppTheme();
  const baseColor = tier === 'panel' ? theme.colors.surface : theme.colors.surfaceElevated;

  const card = (
    <View
      style={[
        styles.base,
        !glass && theme.shadow.sm,
        {
          backgroundColor: glass ? withAlpha(baseColor, 0.55) : baseColor,
          borderColor: glass ? withAlpha(theme.colors.primary, 0.22) : theme.colors.border,
          borderRadius: theme.radius.card,
          padding: theme.spacing.lg,
        },
        style,
      ]}>
      {children}
    </View>
  );

  return glow ? <GlowSurface borderRadius={theme.radius.card}>{card}</GlowSurface> : card;
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
