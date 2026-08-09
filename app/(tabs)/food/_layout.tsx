import { Stack } from 'expo-router';

export default function FoodLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Food Tracker' }} />
      <Stack.Screen name="new" options={{ title: 'Log Food', presentation: 'modal' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan Barcode', presentation: 'modal' }} />
      <Stack.Screen name="analytics" options={{ title: 'Food Analytics' }} />
    </Stack>
  );
}
