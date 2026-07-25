import { Stack } from 'expo-router';

export default function FinanceLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Finance' }} />
      <Stack.Screen name="new" options={{ title: 'New Transaction', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Transaction' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="accounts/new" options={{ title: 'New Account', presentation: 'modal' }} />
      <Stack.Screen name="goals/index" options={{ title: 'Goals' }} />
      <Stack.Screen name="goals/new" options={{ title: 'New Goal', presentation: 'modal' }} />
      <Stack.Screen name="goals/[id]" options={{ title: 'Goal' }} />
      <Stack.Screen name="debts/index" options={{ title: 'Debts' }} />
      <Stack.Screen name="debts/new" options={{ title: 'New Debt', presentation: 'modal' }} />
      <Stack.Screen name="debts/[id]" options={{ title: 'Debt' }} />
      <Stack.Screen name="planned/index" options={{ title: 'Planned payments' }} />
      <Stack.Screen name="planned/new" options={{ title: 'New Planned Payment', presentation: 'modal' }} />
      <Stack.Screen name="labels/index" options={{ title: 'Labels' }} />
    </Stack>
  );
}
