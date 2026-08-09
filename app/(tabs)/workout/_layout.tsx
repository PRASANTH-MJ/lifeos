import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Workout Tracker' }} />
      <Stack.Screen name="all" options={{ title: 'All workouts' }} />
      <Stack.Screen name="new" options={{ title: 'New Workout', presentation: 'modal' }} />
      <Stack.Screen name="[workoutKey]" options={{ title: 'Workout' }} />
      <Stack.Screen name="session/[key]" options={{ title: 'Workout Session' }} />
      <Stack.Screen name="analytics" options={{ title: 'Workout Progress' }} />
      <Stack.Screen name="exercises/index" options={{ title: 'Exercise Library' }} />
      <Stack.Screen name="exercises/[key]" options={{ title: 'Exercise' }} />
    </Stack>
  );
}
