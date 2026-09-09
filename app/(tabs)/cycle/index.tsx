import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Card, IconBadge, LoadingState, ScreenContainer } from '@/components';
import { useCycleLogs, useCycleMoodCorrelation, useCyclePreferences, predictNextPeriod } from '@/modules/cycle';
import { formatDisplayDate } from '@/lib/date';
import { useAppTheme } from '@/theme';

const PHASE_LABELS: Record<string, string> = {
  menstrual: 'Period',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

const PHASE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  menstrual: 'water',
  follicular: 'leaf-outline',
  ovulation: 'sunny-outline',
  luteal: 'moon-outline',
};

export default function CycleScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { trackingEnabled, averageCycleLength, averagePeriodLength, update, loading: prefsLoading } = useCyclePreferences();
  const { logs, loading: logsLoading } = useCycleLogs();
  const { averages, loading: correlationLoading } = useCycleMoodCorrelation();

  if (prefsLoading || logsLoading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!trackingEnabled) {
    return (
      <ScreenContainer>
        <View style={{ gap: theme.spacing.xl }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Cycle Tracking
          </Text>
          <Card tier="panel" style={{ gap: theme.spacing.md, alignItems: 'center' }}>
            <IconBadge name="water" color={theme.colors.moduleJournal} size="lg" />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold, textAlign: 'center' }}>
              Track your cycle, privately
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center', lineHeight: 20 }}>
              Log periods and symptoms to see predicted dates and how your mood and energy tend to shift across your cycle. This is
              off by default and only ever visible to you.
            </Text>
            <Button label="Turn on cycle tracking" onPress={() => update({ trackingEnabled: true })} glow />
          </Card>
        </View>
      </ScreenContainer>
    );
  }

  const prediction = predictNextPeriod(logs, averageCycleLength, averagePeriodLength);

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Cycle Tracking
        </Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Card tier="elevated" style={{ flex: 1, alignItems: 'center', gap: theme.spacing.sm }}>
            <IconBadge name="calendar-outline" color={theme.colors.moduleJournal} size="sm" />
            <Text style={{ color: theme.colors.moduleJournal, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {prediction.currentCycleDay ?? '—'}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
              Day of cycle{prediction.currentPhase ? ` · ${PHASE_LABELS[prediction.currentPhase]}` : ''}
            </Text>
          </Card>
          <Card tier="elevated" style={{ flex: 1, alignItems: 'center', gap: theme.spacing.sm }}>
            <IconBadge name="time-outline" color={theme.colors.moduleJournal} size="sm" />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
              {prediction.nextPredictedStart ? formatDisplayDate(prediction.nextPredictedStart) : 'Log a period to predict'}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
              Next predicted period
            </Text>
          </Card>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button label="Log today" onPress={() => router.push('/cycle-new')} glow />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Log past periods" variant="secondary" onPress={() => router.push('/cycle-backfill')} />
          </View>
        </View>

        {!correlationLoading && averages ? (
          <Card tier="panel" style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
              Mood by phase
            </Text>
            {(['menstrual', 'follicular', 'ovulation', 'luteal'] as const).map((phase) => {
              const stat = averages[phase];
              return (
                <View key={phase} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <IconBadge name={PHASE_ICONS[phase]} color={theme.colors.moduleJournal} size="sm" />
                  <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{PHASE_LABELS[phase]}</Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'right' }}>
                    {stat.days === 0
                      ? 'No data yet'
                      : `Mood ${stat.mood != null ? stat.mood.toFixed(1) : '—'} · Energy ${stat.energy != null ? stat.energy.toFixed(1) : '—'} · Stress ${stat.stress != null ? stat.stress.toFixed(1) : '—'}`}
                  </Text>
                </View>
              );
            })}
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Based on your daily check-ins in Journal — needs a few logged cycles to be meaningful.
            </Text>
          </Card>
        ) : null}

        <Button label="Turn off cycle tracking" variant="ghost" onPress={() => update({ trackingEnabled: false })} />
      </View>
    </ScreenContainer>
  );
}
