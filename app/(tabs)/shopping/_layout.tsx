import { Stack } from 'expo-router';

export default function ShoppingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Shopping Lists', headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'New List', presentation: 'modal' }} />
      <Stack.Screen name="[listId]" options={{ title: 'Shopping List' }} />
    </Stack>
  );
}
