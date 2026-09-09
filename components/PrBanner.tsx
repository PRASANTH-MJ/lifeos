import { Text, View } from 'react-native';

import { Card } from './Card';
import { IconBadge } from './IconBadge';
import { useAppTheme } from '@/theme';

type Props = {
  /** What was beaten — e.g. "Longest distance", "Fastest pace", "Bench Press". Shown as the
   * detail line under the headline. */
  label: string;
};

/** The "New PR! 🎉" moment — shown right where a personal record was just beaten (cardio save
 * screen, exercise log form, workout-complete screen), styled like the rest of the Card/IconBadge
 * "achievement" language (Trophy Case on the social profile screen uses the same trophy icon +
 * tinted-badge look) rather than inventing a new visual vocabulary just for this. */
export function PrBanner({ label }: Props) {
  const theme = useAppTheme();
  return (
    <Card tier="elevated" glow style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <IconBadge name="trophy" color={theme.colors.warning} size="md" />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
          New PR! 🎉
        </Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{label}</Text>
      </View>
    </Card>
  );
}
