import { View } from 'react-native';

import { GlowSurface } from './GlowSurface';
import { useAppTheme } from '@/theme';

type Props = {
  /** 0-1 */
  progress: number;
  color?: string;
  /** Track/fill thickness. Defaults to 8. */
  height?: number;
  /** Wraps the fill in a subtle GlowSurface halo — for the one or two hero progress bars per
   * screen (e.g. a goal's own detail page), not every compact tile footer. */
  glow?: boolean;
};

/** Shared rounded-full progress track + fill, used for budget/goal/debt-payoff progress across
 * the finance module. Reads all color from the active theme so it matches under all 5 themes. */
export function ProgressBar({ progress, color, height = 8, glow }: Props) {
  const theme = useAppTheme();
  const fillColor = color ?? theme.colors.primary;
  const clamped = Math.max(0, Math.min(progress, 1));

  const track = (
    <View
      style={{
        height,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: theme.radius.full,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );

  return glow ? (
    <GlowSurface color={fillColor} intensity="sm" borderRadius={theme.radius.full}>
      {track}
    </GlowSurface>
  ) : (
    track
  );
}
