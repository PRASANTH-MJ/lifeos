import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, LoadingState, ScreenContainer, TextField } from '@/components';
import { CalendarMonthGrid } from '@/modules/calendar';
import { monthCursorOf, shiftMonth, formatDisplayDate, todayKey } from '@/lib/date';
import { formatCurrency, useFinanceGoals, useGoalContributions } from '@/modules/finance';
import { useAppTheme } from '@/theme';
import { Modal } from 'react-native';

const COLORS = ['#3D8BFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#00BCD4'];

export default function GoalDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, loading, refresh: refreshGoals, editGoal, closeGoal, removeGoal } = useFinanceGoals();
  const { contributions, addContribution, removeContribution } = useGoalContributions(id);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(todayKey()));
  const [savingEdit, setSavingEdit] = useState(false);

  const goal = goals.find((g) => g.id === id);

  useFocusEffect(
    useCallback(() => {
      if (goal && !editing) {
        setName(goal.name);
        setColor(goal.color);
        setTargetAmount(String(goal.target_amount));
        setTargetDate(goal.target_date);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goal?.id])
  );

  if (loading || !goal) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const progress = Math.min(goal.current_amount / goal.target_amount, 1);
  const numericAmount = Number(amount);
  const numericTarget = Number(targetAmount);
  const canSaveEdit = name.trim().length > 0 && numericTarget > 0;

  const onSaveEdit = async () => {
    setSavingEdit(true);
    try {
      await editGoal(goal.id, { name: name.trim(), color, targetAmount: numericTarget, targetDate });
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

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
      <Stack.Screen
        options={{
          title: goal.name,
          headerRight: () => (
            <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8}>
              <Ionicons name={editing ? 'close' : 'create-outline'} size={22} color={theme.colors.primary} />
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        {editing ? (
          <Card style={{ gap: theme.spacing.lg }}>
            <TextField label="Goal name" value={name} onChangeText={setName} />
            <TextField label="Target amount" value={targetAmount} onChangeText={setTargetAmount} keyboardType="decimal-pad" />
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Color
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                {COLORS.map((option) => (
                  <Pressable key={option} onPress={() => setColor(option)}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: option,
                        borderWidth: color === option ? 3 : 0,
                        borderColor: theme.colors.textPrimary,
                      }}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Target date (optional)
              </Text>
              <Chip label={targetDate ? targetDate : 'No deadline'} selected={!!targetDate} onPress={() => setDatePickerVisible(true)} />
            </View>
            <Button label="Save changes" onPress={onSaveEdit} disabled={!canSaveEdit} loading={savingEdit} />
          </Card>
        ) : null}

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

      <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
          <Card style={{ borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, gap: theme.spacing.lg }}>
            <CalendarMonthGrid
              year={dateCursor.year}
              month={dateCursor.month}
              selectedDate={targetDate ?? todayKey()}
              markedDates={new Set(targetDate ? [targetDate] : [])}
              onSelectDate={(dateKey) => {
                setTargetDate(dateKey);
                setDatePickerVisible(false);
              }}
              onChangeMonth={(delta) => setDateCursor((cursor) => shiftMonth(cursor, delta))}
            />
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
