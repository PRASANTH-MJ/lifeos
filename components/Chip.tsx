import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  label: string;
  selected?: boolean;
  color?: string;
  mutedColor?: string;
  onPress?: () => void;
};

export function Chip({ label, selected = true, color, mutedColor, onPress }: Props) {
  const theme = useAppTheme();
  const activeColor = color ?? theme.colors.primary;
  const activeMuted = mutedColor ?? theme.colors.primaryMuted;

  const content = (
    <Text
      style={{
        color: selected ? activeColor : theme.colors.textSecondary,
        fontSize: theme.typography.size.sm,
        fontWeight: theme.typography.weight.medium,
      }}>
      {label}
    </Text>
  );

  const containerStyle = [
    styles.base,
    {
      backgroundColor: selected ? activeMuted : theme.colors.surface,
      borderColor: selected ? activeMuted : theme.colors.border,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
  ];

  if (!onPress) {
    return <View style={containerStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [...containerStyle, { opacity: pressed ? 0.65 : 1 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
});
