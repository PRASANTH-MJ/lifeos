import { Stack } from 'expo-router';

export default function MindTrainingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Mind Training' }} />
      <Stack.Screen name="[exerciseKey]" options={{ title: 'Exercise', headerBackTitle: 'Mind Training' }} />
    </Stack>
  );
}
