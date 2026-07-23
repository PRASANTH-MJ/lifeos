import { Stack } from 'expo-router';

export default function BreathingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Breathing' }} />
      <Stack.Screen name="[patternKey]" options={{ title: 'Breathe', headerBackTitle: 'Breathing' }} />
    </Stack>
  );
}
