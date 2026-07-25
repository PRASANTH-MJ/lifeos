import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingState, ScreenContainer, TextField } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { formatCurrency, useDebtPayments, useFinanceDebts } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function DebtDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { debts, remainingById, refresh: refreshDebts, setClosed, removeDebt } = useFinanceDebts();
  const { payments, addPayment, removePayment } = useDebtPayments(id);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const debt = debts.find((d) => d.id === id);

  if (!debt) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const remaining = remainingById[debt.id] ?? debt.amount;
  const isLent = debt.direction === 'lent';
  const numericAmount = Number(amount);

  // Remaining balance is derived in the sibling useFinanceDebts() hook, which only refetches on
  // focus — nudge it here too so logging a payment updates the total on this same screen.
  const onLogPayment = async () => {
    if (!(numericAmount > 0)) return;
    setSaving(true);
    try {
      await addPayment(numericAmount, todayKey());
      await refreshDebts();
      setAmount('');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete debt?', 'This removes the debt and its payment history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeDebt(debt.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: debt.person_name }} />
      <View style={{ gap: theme.spacing.xl }}>
        <Card style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {isLent ? `${debt.person_name} owes you` : `You owe ${debt.person_name}`}
          </Text>
          <Text
            style={{
              color: isLent ? theme.colors.success : theme.colors.danger,
              fontSize: theme.typography.size['2xl'],
              fontWeight: theme.typography.weight.bold,
            }}>
            {formatCurrency(remaining)}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>of {formatCurrency(debt.amount)} total</Text>
          {debt.note ? <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{debt.note}</Text> : null}
        </Card>

        {!debt.is_closed && remaining > 0 ? (
          <Card style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Log a repayment
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              </View>
              <Button label="Add" onPress={onLogPayment} disabled={!(numericAmount > 0)} loading={saving} />
            </View>
          </Card>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Payments
          </Text>
          {payments.length === 0 ? (
            <EmptyState icon="cash-outline" title="No payments logged yet" />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {payments.map((payment) => (
                <Card key={payment.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDate(payment.date)}</Text>
                  </View>
                  <Pressable onPress={() => removePayment(payment.id).then(refreshDebts)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                  </Pressable>
                </Card>
              ))}
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button label={debt.is_closed ? 'Reopen' : 'Mark as closed'} variant="secondary" onPress={() => setClosed(debt.id, !debt.is_closed)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Delete" variant="danger" onPress={onDelete} />
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
