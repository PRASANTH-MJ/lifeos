import { Stack } from 'expo-router';

export default function CardioLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Activity Tracker', headerShown: false }} />
      <Stack.Screen name="[activity]/index" options={{ title: 'Activity' }} />
      <Stack.Screen name="[activity]/record" options={{ title: 'Recording', headerShown: false }} />
    </Stack>
  );
}
