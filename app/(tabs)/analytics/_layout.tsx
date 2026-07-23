import { Stack } from 'expo-router';

export default function AnalyticsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Insights' }} />
    </Stack>
  );
}
