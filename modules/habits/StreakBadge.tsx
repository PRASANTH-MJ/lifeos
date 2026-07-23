import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  streak: number;
};

export function StreakBadge({ streak }: Props) {
  const theme = useAppTheme();
  if (streak <= 0) return null;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: theme.colors.warningMuted,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 2,
          gap: 3,
        },
      ]}>
      <Ionicons name="flame" size={13} color={theme.colors.warning} />
      <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.bold }}>
        {streak}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
