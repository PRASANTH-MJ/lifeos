import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Card, LoadingState, MuscleRecoveryDiagram, PremiumGate, ScreenContainer } from '@/components';
import { MUSCLES, useMuscleRecovery } from '@/modules/workout';
import { useAppTheme } from '@/theme';

function recoveryColor(theme: ReturnType<typeof useAppTheme>, recovery: number): string {
  if (recovery >= 80) return theme.colors.success;
  if (recovery >= 50) return theme.colors.warning;
  return theme.colors.danger;
}

function recoveryLabel(recovery: number): string {
  if (recovery >= 80) return 'Optimal';
  if (recovery >= 50) return 'Fair';
  return 'High fatigue';
}

export default function MuscleRecoveryScreen() {
  const theme = useAppTheme();
  const { recoveryByMuscle, overallRecovery, loading } = useMuscleRecovery();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const sortedMuscles = [...MUSCLES].sort((a, b) => (recoveryByMuscle[a] ?? 100) - (recoveryByMuscle[b] ?? 100));
  const overallColor = recoveryColor(theme, overallRecovery);

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: 'Muscle Recovery' }} />
      <PremiumGate
        feature="muscleRecovery"
        icon="body-outline"
        title="Muscle Recovery is a Pro feature"
        message="See which muscle groups are fatigued and which are ready to train, based on your last 10 days of workouts. Go Pro to unlock it.">
      <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }} showsVerticalScrollIndicator={false}>
        <Card tier="panel" style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Text
            style={{
              color: theme.colors.textTertiary,
              fontSize: theme.typography.size.xs,
              fontWeight: theme.typography.weight.semibold,
              letterSpacing: 1,
            }}>
            OVERALL READINESS
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ color: theme.colors.primary, fontSize: 56, fontWeight: theme.typography.weight.bold, lineHeight: 60 }}>
              {overallRecovery}
            </Text>
            <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>%</Text>
          </View>
          <Text style={{ color: overallColor, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
            {overallRecovery >= 80 ? 'Optimal state for training' : overallRecovery >= 50 ? 'Fair — train with care' : 'High fatigue — consider resting'}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
            Average across all muscle groups, based on the last 10 days of training.
          </Text>
        </Card>

        <Card tier="panel" style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Muscle map
          </Text>
          <MuscleRecoveryDiagram recoveryByMuscle={recoveryByMuscle} />
        </Card>

        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          Localized fatigue
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {sortedMuscles.map((muscle) => {
            const recovery = recoveryByMuscle[muscle] ?? 100;
            const color = recoveryColor(theme, recovery);
            return (
              <Card key={muscle} style={{ flexBasis: '47%', flexGrow: 1, gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {muscle}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 2,
                      borderRadius: theme.radius.full,
                      backgroundColor: `${color}20`,
                    }}>
                    <Text style={{ color, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                      {recoveryLabel(recovery)}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Recovery</Text>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {recovery}%
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${recovery}%`, borderRadius: 3, backgroundColor: color }} />
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
      </PremiumGate>
    </ScreenContainer>
  );
}
