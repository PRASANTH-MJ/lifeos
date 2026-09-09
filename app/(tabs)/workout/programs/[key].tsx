import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Button, Card, EmptyState, IconBadge, LoadingState, ScreenContainer } from '@/components';
import { useProfile } from '@/modules/profile';
import { findProgram, isProgramFree, useExerciseCatalog, usePrograms, useRoutineProgress } from '@/modules/workout';
import { useAppTheme } from '@/theme';

/** Program exercises can reference any key in the synced catalog (834+ exercises), not just the
 * original 228 bundled ones — so this humanizes the raw key as a fallback for the brief window
 * before a fresh install's first catalog sync completes, rather than showing a bare slug. */
function humanizeKey(key: string): string {
  return key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProgramDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { programs, loading } = usePrograms();
  const { exercises: catalogExercises } = useExerciseCatalog();
  const { profile } = useProfile();
  const { progress, dayLogs, startProgram, completeDay } = useRoutineProgress();
  const program = findProgram(programs, key ?? '');
  const isActiveProgram = !!program && progress?.programKey === program.key;
  const programComplete = isActiveProgram && !!program && (progress?.weekNumber ?? 1) > program.weeks;
  const currentDayIndex = isActiveProgram ? (progress?.dayIndex ?? 0) : -1;

  const onMarkDayComplete = async (dayIndex: number, dayKey: string) => {
    if (!program || !progress) return;
    const nextDayIndex = (dayIndex + 1) % program.days.length;
    const nextWeekNumber = nextDayIndex === 0 ? progress.weekNumber + 1 : progress.weekNumber;
    await completeDay({
      programKey: program.key,
      dayKey,
      weekNumber: progress.weekNumber,
      nextDayIndex,
      nextWeekNumber,
    });
  };

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!program) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Program not found" />
      </ScreenContainer>
    );
  }

  if (!profile?.premium && !isProgramFree(program.key)) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: program.title }} />
        <EmptyState
          icon="lock-closed"
          title="This is a Pro program"
          subtitle="Go Pro to unlock the full workout program library."
          ctaLabel="Go Pro"
          onPressCta={() => router.push('/premium')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: program.title }} />
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{program.description}</Text>

        {programComplete ? (
          <Card tier="panel" style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="trophy" size={28} color={theme.colors.warning} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
              Program complete!
            </Text>
            <Button label="Restart Program" variant="secondary" onPress={() => startProgram(program.key)} />
          </Card>
        ) : isActiveProgram ? (
          <Card tier="panel" style={{ gap: 4 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
              Week {progress?.weekNumber} of {program.weeks} · Day {currentDayIndex + 1} of {program.days.length}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Currently on: {program.days[currentDayIndex]?.title}</Text>
          </Card>
        ) : (
          <Button label="Start Program" onPress={() => startProgram(program.key)} glow />
        )}

        {program.days.map((day, dayIndex) => {
          const isCurrentDay = isActiveProgram && !programComplete && dayIndex === currentDayIndex;
          const isDoneThisWeek = isActiveProgram && dayLogs.some((l) => l.dayKey === day.key && l.weekNumber === progress?.weekNumber);
          return (
            <View key={day.key} style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                  {day.title}
                </Text>
                {isDoneThisWeek ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} /> : null}
                {isCurrentDay ? (
                  <View style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.radius.full, backgroundColor: theme.colors.primaryMuted }}>
                    <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>Today</Text>
                  </View>
                ) : null}
              </View>
              {day.exercises.map((exercise) => {
                const catalogExercise = catalogExercises.find((e) => e.key === exercise.exerciseKey);
                return (
                  <Card key={exercise.exerciseKey} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name="barbell" color={theme.colors.moduleTasks} size="sm" />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                      {catalogExercise?.name ?? humanizeKey(exercise.exerciseKey)}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 4,
                        borderRadius: theme.radius.full,
                        backgroundColor: theme.colors.moduleTasksMuted,
                      }}>
                      <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                        {exercise.sets}×{exercise.reps}
                        {exercise.note ? ` (${exercise.note})` : ''}
                      </Text>
                    </View>
                  </Card>
                );
              })}
              {isCurrentDay && !isDoneThisWeek ? (
                <Button label="Mark Day Complete" onPress={() => onMarkDayComplete(dayIndex, day.key)} />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}
