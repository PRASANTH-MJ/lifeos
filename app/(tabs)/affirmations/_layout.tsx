import { Stack } from 'expo-router';

export default function AffirmationsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Affirmations' }} />
      <Stack.Screen name="all" options={{ title: 'All affirmations' }} />
      <Stack.Screen name="new" options={{ title: 'New Affirmation', presentation: 'modal' }} />
    </Stack>
  );
}
