import { Stack } from 'expo-router';

export default function CycleLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Cycle Tracking' }} />
    </Stack>
  );
}
