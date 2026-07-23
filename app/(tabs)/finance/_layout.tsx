import { Stack } from 'expo-router';

export default function FinanceLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Finance' }} />
      <Stack.Screen name="new" options={{ title: 'New Transaction', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Transaction' }} />
    </Stack>
  );
}
