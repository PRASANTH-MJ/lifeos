import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, ScreenContainer, TextField } from '@/components';
import { monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { BUDGET_PERIOD_LABELS, useFinanceBudgetPlans, useFinanceCategories, type BudgetPeriod } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const PERIODS: BudgetPeriod[] = ['weekly', 'monthly', 'yearly', 'one_time'];

export default function NewBudgetScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { addBudgetPlan } = useFinanceBudgetPlans();
  const { categories } = useFinanceCategories();
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const [name, setName] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('monthly');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(todayKey()));
  const [saving, setSaving] = useState(false);

  const numericAmount = Number(amount);
  const canSave = name.trim().length > 0 && numericAmount > 0 && (period !== 'one_time' || startDate <= endDate);

  const onSave = async () => {
    setSaving(true);
    try {
      await addBudgetPlan({
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

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="Budget name" placeholder="e.g. Groceries, Vacation" value={name} onChangeText={setName} autoFocus />
        <TextField label="Amount" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

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

        <Button label="Save budget" onPress={onSave} disabled={!canSave} loading={saving} />
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
