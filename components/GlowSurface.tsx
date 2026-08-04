import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

type Intensity = 'sm' | 'md' | 'lg';

/**
 * Android has no native colored-shadow/blur support, so "glow" everywhere in this app is faked by
 * stacking a few semi-transparent, slightly-oversized same-color layers behind the real content —
 * each layer peeks out past the content's edges, reading as an ambient light bleed. Not a real
 * blur, but it renders identically and reliably on both Android and web.
 */
const LAYER_CONFIG: Record<Intensity, { spread: number; opacity: number }[]> = {
  sm: [{ spread: 5, opacity: 0.14 }],
  md: [
    { spread: 12, opacity: 0.08 },
    { spread: 6, opacity: 0.14 },
  ],
  lg: [
    { spread: 20, opacity: 0.06 },
    { spread: 12, opacity: 0.1 },
    { spread: 5, opacity: 0.18 },
  ],
};

type Props = {
  children: ReactNode;
  color?: string;
  intensity?: Intensity;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function GlowSurface({ children, color, intensity = 'md', borderRadius, style }: Props) {
  const theme = useAppTheme();
  const glowColor = color ?? theme.colors.glow;
  const radius = borderRadius ?? theme.radius.lg;
  const layers = LAYER_CONFIG[intensity];

  return (
    <View style={[styles.wrapper, style]}>
      {layers.map((layer, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.glowLayer,
            {
              backgroundColor: glowColor,
              opacity: layer.opacity,
              borderRadius: radius + layer.spread,
              top: -layer.spread,
              left: -layer.spread,
              right: -layer.spread,
              bottom: -layer.spread,
            },
          ]}
        />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  glowLayer: {
    position: 'absolute',
  },
});
