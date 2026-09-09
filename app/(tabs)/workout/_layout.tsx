import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Workout Tracker' }} />
      <Stack.Screen name="all" options={{ title: 'All workouts' }} />
      <Stack.Screen name="new" options={{ title: 'New Workout', presentation: 'modal' }} />
      <Stack.Screen name="[workoutKey]" options={{ title: 'Workout' }} />
      <Stack.Screen name="session/[key]" options={{ title: 'Workout Session' }} />
      {/* gestureEnabled: false alongside headerBackVisible: false — the header button alone
          doesn't stop the iOS edge-swipe gesture, and nothing here is persisted until "Finish
          workout" (see live-session.tsx's onFinish), so a swipe was silently dropping the whole
          in-progress session. */}
      <Stack.Screen name="live-session" options={{ title: 'Workout', headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="analytics" options={{ title: 'Workout Progress' }} />
      <Stack.Screen name="exercises/index" options={{ title: 'Exercise Library' }} />
      <Stack.Screen name="exercises/[key]" options={{ title: 'Exercise' }} />
      <Stack.Screen name="programs" options={{ title: 'Suggested Programs' }} />
      <Stack.Screen name="programs/[key]" options={{ title: 'Program' }} />
      <Stack.Screen name="recovery" options={{ title: 'Muscle Recovery' }} />
    </Stack>
  );
}
