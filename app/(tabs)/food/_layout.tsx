import { Stack } from 'expo-router';

export default function FoodLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Food Tracker' }} />
      <Stack.Screen name="analytics" options={{ title: 'Food Analytics' }} />
      <Stack.Screen name="plans" options={{ title: 'Meal Plans' }} />
      <Stack.Screen name="plans/[key]" options={{ title: 'Meal Plan' }} />
    </Stack>
  );
}
