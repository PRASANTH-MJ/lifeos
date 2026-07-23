import { Stack } from 'expo-router';

export default function ShoppingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Shopping List' }} />
    </Stack>
  );
}
