import { Stack } from 'expo-router';

export default function CalendarLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Calendar' }} />
      <Stack.Screen name="new" options={{ title: 'New Event', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Event' }} />
    </Stack>
  );
}
