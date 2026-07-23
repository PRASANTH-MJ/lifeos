import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

export function RangeChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.surface,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
      }}>
      <Text style={{ color: selected ? theme.colors.primary : theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Legend({ color, label }: { color: string; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>{label}</Text>
    </View>
  );
}
