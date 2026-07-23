import { Stack } from 'expo-router';

export default function HabitsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Habits' }} />
      <Stack.Screen name="new" options={{ title: 'New Habit', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Habit' }} />
    </Stack>
  );
}
