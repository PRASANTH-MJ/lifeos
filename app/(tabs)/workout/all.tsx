import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, RowActionsMenu, ScreenContainer } from '@/components';
import { WORKOUTS, equipmentLabel, goalLabel, useCustomWorkouts } from '@/modules/workout';
import { useAppTheme } from '@/theme';

export default function AllWorkoutsScreen() {
  const theme = useAppTheme();
  const { workouts: customWorkouts, removeWorkout, refresh } = useCustomWorkouts();
  const allWorkouts = [...WORKOUTS, ...customWorkouts];

  return (
    <ScreenContainer onRefresh={refresh}>
      <View style={{ gap: theme.spacing.sm }}>
        {allWorkouts.map((workout) => {
          const isCustom = workout.key.startsWith('custom-');
          return (
            <Card key={workout.key} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Link href={{ pathname: '/workout/[workoutKey]', params: { workoutKey: workout.key } }} asChild>
                <Pressable style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                    {workout.title}
                  </Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                    {goalLabel(workout.goal)} · {equipmentLabel(workout.equipment)} · {workout.minutes} min
                  </Text>
                </Pressable>
              </Link>
              {isCustom ? <RowActionsMenu itemLabel={workout.title} onDelete={() => removeWorkout(workout.key)} /> : null}
            </Card>
          );
        })}
      </View>
    </ScreenContainer>
  );
}
