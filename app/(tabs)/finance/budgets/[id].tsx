import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, LoadingState, ScreenContainer, TextField } from '@/components';
import { monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { BUDGET_PERIOD_LABELS, useFinanceBudgetPlans, useFinanceCategories, type BudgetPeriod } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const PERIODS: BudgetPeriod[] = ['weekly', 'monthly', 'yearly', 'one_time'];

export default function BudgetDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plans, editBudgetPlan, removeBudgetPlan } = useFinanceBudgetPlans();
  const { categories } = useFinanceCategories();
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const plan = plans.find((p) => p.id === id);

  const [name, setName] = useState(plan?.name ?? '');
  const [period, setPeriod] = useState<BudgetPeriod>(plan?.period ?? 'monthly');
  const [amount, setAmount] = useState(plan ? String(plan.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(plan?.category_id ?? null);
  const [startDate, setStartDate] = useState(plan?.start_date ?? todayKey());
  const [endDate, setEndDate] = useState(plan?.end_date ?? todayKey());
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(todayKey()));
  const [saving, setSaving] = useState(false);

  if (!plan) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const numericAmount = Number(amount);
  const canSave = name.trim().length > 0 && numericAmount > 0 && (period !== 'one_time' || startDate <= endDate);

  const onSave = async () => {
    setSaving(true);
    try {
      await editBudgetPlan(plan.id, {
        name: name.trim(),
        period,
        amount: numericAmount,
        categoryId,
        startDate: period === 'one_time' ? startDate : null,
        endDate: period === 'one_time' ? endDate : null,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete budget?', 'This removes the budget plan.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeBudgetPlan(plan.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: plan.name }} />
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="Budget name" value={name} onChangeText={setName} autoFocus />
        <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Period</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {PERIODS.map((option) => (
              <Chip key={option} label={BUDGET_PERIOD_LABELS[option]} selected={period === option} onPress={() => setPeriod(option)} />
            ))}
          </View>
        </View>

        {period === 'one_time' ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1, gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Start</Text>
              <Chip label={startDate} selected onPress={() => setPickerTarget('start')} />
            </View>
            <View style={{ flex: 1, gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>End</Text>
              <Chip label={endDate} selected onPress={() => setPickerTarget('end')} />
            </View>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Category (optional)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Chip label="Overall" selected={!categoryId} onPress={() => setCategoryId(null)} />
            {expenseCategories.map((category) => (
              <Chip key={category.id} label={category.name} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} color={category.color} />
            ))}
          </View>
        </View>

        <Button label="Save changes" onPress={onSave} disabled={!canSave} loading={saving} />
        <Button label="Delete budget" variant="danger" onPress={onDelete} />
      </View>

      <Modal visible={pickerTarget !== null} animationType="slide" transparent onRequestClose={() => setPickerTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setPickerTarget(null)} />
          <Card style={{ borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, gap: theme.spacing.lg }}>
            <CalendarMonthGrid
              year={dateCursor.year}
              month={dateCursor.month}
              selectedDate={pickerTarget === 'start' ? startDate : endDate}
              markedDates={new Set([pickerTarget === 'start' ? startDate : endDate])}
              onSelectDate={(dateKey) => {
                if (pickerTarget === 'start') setStartDate(dateKey);
                else setEndDate(dateKey);
                setPickerTarget(null);
              }}
              onChangeMonth={(delta) => setDateCursor((cursor) => shiftMonth(cursor, delta))}
            />
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
