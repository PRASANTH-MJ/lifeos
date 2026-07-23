import { Stack } from 'expo-router';

export default function MeditationLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Meditation' }} />
      <Stack.Screen name="[sessionKey]" options={{ title: 'Session', headerBackTitle: 'Meditation' }} />
      <Stack.Screen name="timer" options={{ title: 'Timer', presentation: 'modal' }} />
    </Stack>
  );
}
