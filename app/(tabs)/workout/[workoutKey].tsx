import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';

import { Button, Card, EmptyState, IconBadge, ScreenContainer, showAlert } from '@/components';
import { usePostComposer } from '@/modules/social';
import { WORKOUTS, equipmentLabel, goalLabel, groupExerciseRuns, useCustomWorkouts, useWorkoutLogs } from '@/modules/workout';
import { useAppTheme } from '@/theme';

export default function WorkoutDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { workoutKey } = useLocalSearchParams<{ workoutKey: string }>();
  const { workouts: customWorkouts } = useCustomWorkouts();
  const workout = [...WORKOUTS, ...customWorkouts].find((w) => w.key === workoutKey);
  const { logCompletion } = useWorkoutLogs();
  const { createPost, posting } = usePostComposer();

  if (!workout) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Workout not found" />
      </ScreenContainer>
    );
  }

  const isCustom = workout.key.startsWith('custom-');
  const runs = groupExerciseRuns(workout.exercises, workout.exerciseGroups);

  // Shares only the exercise STRUCTURE (names, order, superset grouping) as a `workoutTemplate`
  // post — never the user's own personal log history, which is exactly the point: another user
  // importing it gets a fresh, empty copy of the same routine, not a peek at someone else's sets.
  const onShareAsTemplate = async () => {
    await createPost({
      type: 'workoutTemplate',
      card: {
        eyebrow: 'WORKOUT TEMPLATE',
        value: String(workout.exercises.length),
        valueLabel: `EXERCISE${workout.exercises.length === 1 ? '' : 'S'}`,
        detail: `${goalLabel(workout.goal)} · ${equipmentLabel(workout.equipment)} · ${workout.minutes} min`,
        icon: 'barbell',
        accentColor: theme.colors.moduleTasks,
      },
      workoutTemplate: {
        title: workout.title,
        goal: workout.goal,
        equipment: workout.equipment,
        minutes: workout.minutes,
        exercises: workout.exercises.map((text, index) => ({ text, supersetGroup: workout.exerciseGroups?.[index] ?? null })),
      },
    });
    showAlert('Shared', 'Your workout template was posted to the Feed.');
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            {workout.title}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {goalLabel(workout.goal)} · {equipmentLabel(workout.equipment)} · {workout.minutes} min
          </Text>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          {runs.map((run, runIndex) =>
            run.superset ? (
              <Card
                key={`run-${runIndex}`}
                style={{ gap: theme.spacing.sm, borderLeftWidth: 3, borderLeftColor: theme.colors.moduleTasks }}>
                <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.bold }}>
                  SUPERSET
                </Text>
                {run.items.map((item) => (
                  <View key={item.index} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name="barbell" color={theme.colors.moduleTasks} size="sm" />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>{item.text}</Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Card key={`run-${runIndex}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <IconBadge name="barbell" color={theme.colors.moduleTasks} size="sm" />
                <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>{run.items[0].text}</Text>
              </Card>
            )
          )}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Start workout"
            onPress={() => router.push({ pathname: '/workout/session/[key]', params: { key: workout.key } })}
            glow
          />
          <Button
            label="Already did it — mark complete"
            variant="secondary"
            onPress={async () => {
              await logCompletion(workout.key);
              router.back();
            }}
          />
          {isCustom ? (
            <Pressable
              onPress={onShareAsTemplate}
              disabled={posting}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: theme.spacing.sm }}>
              <Ionicons name="share-social-outline" size={16} color={theme.colors.moduleTasks} />
              <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Share as template
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}
