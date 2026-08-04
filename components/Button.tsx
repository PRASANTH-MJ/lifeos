import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient';
type SolidVariant = Exclude<Variant, 'gradient'>;

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled }: Props) {
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

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
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
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
