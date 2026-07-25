import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingState, ScreenContainer, TextField } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { formatCurrency, useFinanceGoals, useGoalContributions } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function GoalDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, loading, refresh: refreshGoals, closeGoal, removeGoal } = useFinanceGoals();
  const { contributions, addContribution, removeContribution } = useGoalContributions(id);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const goal = goals.find((g) => g.id === id);

  if (loading || !goal) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const progress = Math.min(goal.current_amount / goal.target_amount, 1);
  const numericAmount = Number(amount);

  // A contribution updates `current_amount` via a DB trigger, but that lives in the sibling
  // useFinanceGoals() hook's own state — it only refetches on focus, so nudge it here too.
  const onContribute = async () => {
    if (!(numericAmount > 0)) return;
    setSaving(true);
    try {
      await addContribution(numericAmount, todayKey());
      await refreshGoals();
      setAmount('');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete goal?', 'This removes the goal and its contribution history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeGoal(goal.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: goal.name }} />
      <View style={{ gap: theme.spacing.xl }}>
        <Card style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {formatCurrency(goal.current_amount)}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>of {formatCurrency(goal.target_amount)}</Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: goal.color }} />
          </View>
          {goal.target_date ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Target date: {formatDisplayDate(goal.target_date)}</Text>
          ) : null}
        </Card>

        {!goal.is_closed ? (
          <Card style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Add a contribution
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              </View>
              <Button label="Add" onPress={onContribute} disabled={!(numericAmount > 0)} loading={saving} />
            </View>
          </Card>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Contributions
          </Text>
          {contributions.length === 0 ? (
            <EmptyState icon="cash-outline" title="No contributions yet" />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {contributions.map((contribution) => (
                <Card key={contribution.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                      {formatCurrency(contribution.amount)}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDate(contribution.date)}</Text>
                  </View>
                  <Pressable onPress={() => removeContribution(contribution.id).then(refreshGoals)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                  </Pressable>
                </Card>
              ))}
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button
              label={goal.is_closed ? 'Reopen goal' : 'Mark as closed'}
              variant="secondary"
              onPress={() => closeGoal(goal.id, !goal.is_closed)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Delete goal" variant="danger" onPress={onDelete} />
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
