import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components';
import { WORKOUTS, equipmentLabel, goalLabel } from '@/modules/workout';
import { useAppTheme } from '@/theme';

export default function AllWorkoutsScreen() {
  const theme = useAppTheme();

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.sm }}>
        {WORKOUTS.map((workout) => (
          <Link key={workout.key} href={{ pathname: '/workout/[workoutKey]', params: { workoutKey: workout.key } }} asChild>
            <Pressable>
              <Card style={{ gap: 4 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                  {workout.title}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  {goalLabel(workout.goal)} · {equipmentLabel(workout.equipment)} · {workout.minutes} min
                </Text>
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScreenContainer>
  );
}
