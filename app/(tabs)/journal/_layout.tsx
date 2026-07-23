import { Stack } from 'expo-router';

export default function JournalLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Journal' }} />
      <Stack.Screen name="new" options={{ title: 'New Entry', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Entry' }} />
    </Stack>
  );
}
