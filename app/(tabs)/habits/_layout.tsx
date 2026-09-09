import { Stack } from 'expo-router';

export default function HabitsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Habits', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Habit' }} />
      <Stack.Screen name="chain-new" options={{ title: 'New Chain' }} />
      <Stack.Screen name="chain/[id]" options={{ title: 'Chain' }} />
    </Stack>
  );
}
