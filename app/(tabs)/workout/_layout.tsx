import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Workouts' }} />
      <Stack.Screen name="all" options={{ title: 'All workouts' }} />
      <Stack.Screen name="[workoutKey]" options={{ title: 'Workout' }} />
    </Stack>
  );
}
