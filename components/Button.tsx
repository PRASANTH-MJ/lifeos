import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { GlowSurface } from './GlowSurface';
import { useAppTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient';
type SolidVariant = Exclude<Variant, 'gradient'>;

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Wraps the button in an ambient GlowSurface halo (same technique Card's `glow` prop uses) —
   * opt-in, for the one or two primary CTAs per screen that should read as the main action
   * (matches the Cyber-Sanctuary pattern's neon-glow treatment on hero buttons), not every
   * button everywhere. */
  glow?: boolean;
  /** Forces the label onto a single line and shrinks its font to fit the available width instead
   * of wrapping — opt-in, for buttons in a fixed-width row (e.g. an evenly-split multi-button
   * row) where a wrapped second line would grow that button taller than its neighbors. Any
   * button with a longish label can hit this at large OS/accessibility text-size settings, not
   * just the club action rows this was first added for, so it's a general Button prop rather
   * than a one-off fix. */
  shrinkToFit?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, glow, shrinkToFit }: Props) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
  const isGradient = variant === 'gradient';

  const backgrounds: Record<SolidVariant, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.primaryMuted,
    ghost: 'transparent',
    danger: theme.colors.danger,
  };
  const textColors: Record<Variant, string> = {
    primary: '#FFFFFF',
    secondary: theme.colors.primary,
    ghost: theme.colors.textPrimary,
    danger: '#FFFFFF',
    gradient: '#FFFFFF',
  };

  const elevated = variant === 'primary' || variant === 'danger' || isGradient;

  const button = (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        elevated && !isDisabled ? theme.shadow.sm : null,
        {
          backgroundColor: isGradient ? undefined : backgrounds[variant as SolidVariant],
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          overflow: isGradient ? 'hidden' : 'visible',
        },
      ]}>
      {isGradient && (
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.glow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {loading ? (
        <ActivityIndicator color={textColors[variant]} />
      ) : (
        <Text
          numberOfLines={shrinkToFit ? 1 : undefined}
          adjustsFontSizeToFit={shrinkToFit}
          minimumFontScale={shrinkToFit ? 0.8 : undefined}
          style={{
            color: textColors[variant],
            fontSize: theme.typography.size.base,
            fontWeight: theme.typography.weight.semibold,
          }}>
          {label}
        </Text>
      )}
    </Pressable>
  );

  return glow && !isDisabled ? <GlowSurface borderRadius={theme.radius.md}>{button}</GlowSurface> : button;
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
