import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { IconBadge, ScreenContainer } from '@/components';
import { ACTIVITY_MILESTONE_TIERS, useCardioLogs } from '@/modules/cardio';
import { useAppTheme } from '@/theme';

/** Same locked/unlocked visual language as the habit module's "Streak challenges" grid
 * (app/(tabs)/habits/[id].tsx) — trophy + warning tint when unlocked, a lock icon + neutral
 * background otherwise — just tiered against total activity count instead of streak length, and
 * laid out as a wrapping 3-column grid since there are 25 tiers here instead of 3. */
export default function CardioMilestonesScreen() {
  const theme = useAppTheme();
  const { logs } = useCardioLogs();
  const totalActivities = logs.length;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Milestones' }} />
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            Milestones
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, marginTop: 2 }}>
            {totalActivities} logged so far, across every activity.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {ACTIVITY_MILESTONE_TIERS.map((tier) => {
            const unlocked = totalActivities >= tier.count;
            return (
              <View
                key={tier.count}
                style={{
                  width: '30%',
                  alignItems: 'center',
                  gap: 4,
                  padding: theme.spacing.sm,
                  borderRadius: theme.radius.md,
                  backgroundColor: unlocked ? theme.colors.warningMuted : theme.colors.background,
                  borderWidth: 1,
                  borderColor: unlocked ? theme.colors.warning : theme.colors.border,
                }}>
                <IconBadge name={unlocked ? 'trophy' : 'lock-closed'} color={theme.colors.warning} tone={unlocked ? 'tinted' : 'neutral'} size="sm" />
                <Text
                  style={{
                    color: unlocked ? theme.colors.textPrimary : theme.colors.textTertiary,
                    fontSize: theme.typography.size.xs,
                    fontWeight: theme.typography.weight.medium,
                    textAlign: 'center',
                  }}>
                  {tier.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}
