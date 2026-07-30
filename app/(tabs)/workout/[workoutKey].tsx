import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text } from 'react-native';

import { Button, Card, EmptyState, ScreenContainer } from '@/components';
import { WORKOUTS, equipmentLabel, goalLabel, useCustomWorkouts, useWorkoutLogs } from '@/modules/workout';
import { useAppTheme } from '@/theme';

export default function WorkoutDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { workoutKey } = useLocalSearchParams<{ workoutKey: string }>();
  const { workouts: customWorkouts } = useCustomWorkouts();
  const workout = [...WORKOUTS, ...customWorkouts].find((w) => w.key === workoutKey);
  const { logCompletion } = useWorkoutLogs();

  if (!workout) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Workout not found" />
      </ScreenContainer>
    );
  }

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

        <Card style={{ gap: theme.spacing.sm }}>
          {workout.exercises.map((exercise) => (
            <Text key={exercise} style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
              • {exercise}
            </Text>
          ))}
        </Card>

        <Button
          label="Mark complete"
          onPress={async () => {
            await logCompletion(workout.key);
            router.back();
          }}
        />
      </View>
    </ScreenContainer>
  );
}
