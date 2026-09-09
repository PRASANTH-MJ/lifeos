import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

/** Small "PRO" pill for labeling a Pro-only feature inline (e.g. next to "Exercise Library" or
 * "Muscle Recovery" for a free user) — distinct from UpsellModal, which explains *why* once
 * they've already tapped in. This is the at-a-glance marker before that tap happens. */
export function ProBadge() {
  const theme = useAppTheme();
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: theme.radius.full,
        backgroundColor: withAlpha(theme.colors.primary, 0.16),
      }}>
      <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.bold }}>PRO</Text>
    </View>
  );
}
