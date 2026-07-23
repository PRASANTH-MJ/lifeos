import { Stack } from 'expo-router';

export default function FinanceLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Finance' }} />
      <Stack.Screen name="new" options={{ title: 'New Transaction', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Transaction' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="accounts/new" options={{ title: 'New Account', presentation: 'modal' }} />
    </Stack>
  );
}
