import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, IconBadge, LoadingState, ScreenContainer, TextField, showAlert } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { formatCurrency, useAccounts, useDebtPayments, useFinanceDebts, type DebtDirection } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function DebtDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { debts, remainingById, loading, refresh: refreshDebts, editDebt, setClosed, removeDebt } = useFinanceDebts();
  const { payments, addPayment, removePayment } = useDebtPayments(id);
  const { displayCurrency } = useAccounts();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [personName, setPersonName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('lent');
  const [editAmount, setEditAmount] = useState('');
  const [note, setNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const debt = debts.find((d) => d.id === id);

  useFocusEffect(
    useCallback(() => {
      if (debt && !editing) {
        setPersonName(debt.person_name);
        setDirection(debt.direction);
        setEditAmount(String(debt.amount));
        setNote(debt.note ?? '');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debt?.id])
  );

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!debt) {
    return (
      <ScreenContainer>
        <EmptyState icon="cash-outline" title="Debt not found" subtitle="It may have been deleted." ctaLabel="Go back" onPressCta={() => router.back()} />
      </ScreenContainer>
    );
  }

  const remaining = remainingById[debt.id] ?? debt.amount;
  const isLent = debt.direction === 'lent';
  const numericAmount = Number(amount);
  const numericEditAmount = Number(editAmount);
  const canSaveEdit = personName.trim().length > 0 && numericEditAmount > 0;

  const onSaveEdit = async () => {
    setSavingEdit(true);
    try {
      await editDebt(debt.id, { personName: personName.trim(), direction, amount: numericEditAmount, note: note.trim() || null });
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

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
    showAlert('Delete debt?', 'This removes the debt and its payment history.', [
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
      <Stack.Screen
        options={{
          title: debt.person_name,
          headerRight: () => (
            <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8}>
              <Ionicons name={editing ? 'close' : 'create-outline'} size={22} color={theme.colors.primary} />
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        {editing ? (
          <Card tier="panel" style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Chip
                label="I lent money"
                selected={direction === 'lent'}
                onPress={() => setDirection('lent')}
                color={theme.colors.success}
                mutedColor={theme.colors.successMuted}
              />
              <Chip
                label="I borrowed money"
                selected={direction === 'borrowed'}
                onPress={() => setDirection('borrowed')}
                color={theme.colors.danger}
                mutedColor={theme.colors.dangerMuted}
              />
            </View>
            <TextField label="Person" value={personName} onChangeText={setPersonName} />
            <TextField label="Amount" value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
            <TextField label="Note (optional)" value={note} onChangeText={setNote} />
            <Button label="Save changes" onPress={onSaveEdit} disabled={!canSaveEdit} loading={savingEdit} />
          </Card>
        ) : null}

        <Card tier="panel" style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <IconBadge name={isLent ? 'arrow-up-circle' : 'arrow-down-circle'} color={isLent ? theme.colors.success : theme.colors.danger} size="lg" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                {isLent ? `${debt.person_name} owes you` : `You owe ${debt.person_name}`}
              </Text>
              <Text
                style={{
                  color: isLent ? theme.colors.success : theme.colors.danger,
                  fontSize: theme.typography.size['2xl'],
                  fontWeight: theme.typography.weight.bold,
                }}>
                {formatCurrency(remaining, displayCurrency)}
              </Text>
            </View>
          </View>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            of {formatCurrency(debt.amount, displayCurrency)} total
          </Text>
          {debt.note ? <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{debt.note}</Text> : null}
        </Card>

        {!debt.is_closed && remaining > 0 ? (
          <Card tier="panel" style={{ gap: theme.spacing.md }}>
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
                <Card key={payment.id} tier="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <IconBadge name="checkmark-circle-outline" color={theme.colors.success} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                      {formatCurrency(payment.amount, displayCurrency)}
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
