import { Stack } from 'expo-router';

export default function TimerLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Timer' }} />
    </Stack>
  );
}
