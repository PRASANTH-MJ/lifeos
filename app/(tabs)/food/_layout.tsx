import { Stack } from 'expo-router';

export default function FoodLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Food' }} />
      <Stack.Screen name="new" options={{ title: 'Log Food', presentation: 'modal' }} />
    </Stack>
  );
}
