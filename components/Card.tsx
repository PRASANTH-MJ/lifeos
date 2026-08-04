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
};

export function Card({ children, style, glow, glass }: Props) {
  const theme = useAppTheme();

  const card = (
    <View
      style={[
        styles.base,
        !glass && theme.shadow.sm,
        {
          backgroundColor: glass ? withAlpha(theme.colors.surfaceElevated, 0.55) : theme.colors.surfaceElevated,
          borderColor: glass ? withAlpha(theme.colors.primary, 0.22) : theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
        style,
      ]}>
      {children}
    </View>
  );

  return glow ? <GlowSurface borderRadius={theme.radius.lg}>{card}</GlowSurface> : card;
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
