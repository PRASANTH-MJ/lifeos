import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  streak: number;
  /** When provided, the badge becomes tappable (e.g. to open a share card for this streak). */
  onPress?: () => void;
};

export function StreakBadge({ streak, onPress }: Props) {
  const theme = useAppTheme();
  if (streak <= 0) return null;

  const content = (
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

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
