import { Stack } from 'expo-router';

export default function WaterLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Water Tracker' }} />
    </Stack>
  );
}
