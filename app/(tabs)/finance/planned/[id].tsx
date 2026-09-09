import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, LoadingState, ScreenContainer, TextField, showAlert } from '@/components';
import { monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import {
  FREQUENCY_LABELS,
  cancelPlannedPaymentNotification,
  syncPlannedPaymentNotification,
  useAccounts,
  useFinanceCategories,
  useFinancePlannedPayments,
  type PlannedPaymentFrequency,
  type TransactionType,
} from '@/modules/finance';
import { useAppTheme } from '@/theme';

const FREQUENCIES: PlannedPaymentFrequency[] = ['once', 'weekly', 'monthly', 'yearly'];
const REMIND_DAYS_OPTIONS = [0, 1, 3, 7] as const;

export default function PlannedPaymentDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts } = useAccounts();
  const { categories } = useFinanceCategories();
  const { plannedPayments, editPlannedPayment, removePlannedPayment } = useFinancePlannedPayments();

  const payment = plannedPayments.find((p) => p.id === id);

  const [type, setType] = useState<Exclude<TransactionType, 'transfer'>>(payment?.type ?? 'expense');
  const [accountId, setAccountId] = useState<string | null>(payment?.account_id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(payment?.category_id ?? null);
  const [amount, setAmount] = useState(payment ? String(payment.amount) : '');
  const [payee, setPayee] = useState(payment?.payee ?? '');
  const [frequency, setFrequency] = useState<PlannedPaymentFrequency>(payment?.frequency ?? 'monthly');
  const [nextDate, setNextDate] = useState(payment?.next_date ?? todayKey());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(payment?.next_date ?? todayKey()));
  const [notify, setNotify] = useState(payment?.notify ?? true);
  const [note, setNote] = useState(payment?.note ?? '');
  const [isSubscription, setIsSubscription] = useState(payment?.is_subscription ?? false);
  const [remindDaysBefore, setRemindDaysBefore] = useState(payment?.remind_days_before ?? 0);
  const [saving, setSaving] = useState(false);

  if (!payment) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const relevantCategories = categories.filter((c) => c.type === type);
  const numericAmount = Number(amount);
  const canSave = numericAmount > 0 && Boolean(accountId) && payee.trim().length > 0;

  const onSave = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      await editPlannedPayment(payment.id, {
        accountId,
        categoryId,
        type,
        amount: numericAmount,
        payee: payee.trim(),
        frequency,
        nextDate,
        notify,
        note: note.trim() || null,
        isSubscription,
        remindDaysBefore,
      });
      await syncPlannedPaymentNotification({
        id: payment.id,
        payee: payee.trim(),
        amount: numericAmount,
        next_date: nextDate,
        notify,
        type,
        remind_days_before: remindDaysBefore,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    showAlert('Delete planned payment?', 'This removes the schedule.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelPlannedPaymentNotification(payment.id);
          await removePlannedPayment(payment.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: payment.payee }} />
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Chip
            label="Expense"
            selected={type === 'expense'}
            onPress={() => {
              setType('expense');
              setCategoryId(null);
            }}
            color={theme.colors.danger}
            mutedColor={theme.colors.dangerMuted}
          />
          <Chip
            label="Income"
            selected={type === 'income'}
            onPress={() => {
              setType('income');
              setCategoryId(null);
            }}
            color={theme.colors.success}
            mutedColor={theme.colors.successMuted}
          />
        </View>

        <TextField label="Payee" value={payee} onChangeText={setPayee} />
        <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Account</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {accounts.map((account) => (
              <Chip key={account.id} label={account.name} selected={accountId === account.id} onPress={() => setAccountId(account.id)} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {relevantCategories.map((category) => (
              <Chip key={category.id} label={category.name} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} color={category.color} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Frequency</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {FREQUENCIES.map((option) => (
              <Chip key={option} label={FREQUENCY_LABELS[option]} selected={frequency === option} onPress={() => setFrequency(option)} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {frequency === 'once' ? 'Date' : 'Next occurrence'}
          </Text>
          <Chip label={nextDate} selected onPress={() => setDatePickerVisible(true)} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
            Subscription
          </Text>
          <Switch value={isSubscription} onValueChange={setIsSubscription} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
            Remind me
          </Text>
          <Switch value={notify} onValueChange={setNotify} />
        </View>

        {notify ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Remind me
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {REMIND_DAYS_OPTIONS.map((days) => (
                <Chip
                  key={days}
                  label={days === 0 ? 'On due date' : `${days} day${days === 1 ? '' : 's'} before`}
                  selected={remindDaysBefore === days}
                  onPress={() => setRemindDaysBefore(days)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <TextField label="Note (optional)" value={note} onChangeText={setNote} />

        <Button label="Save changes" onPress={onSave} disabled={!canSave} loading={saving} />
        <Button label="Delete planned payment" variant="danger" onPress={onDelete} />
      </View>

      <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
          <Card tier="panel" style={{ borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, gap: theme.spacing.lg }}>
            <CalendarMonthGrid
              year={dateCursor.year}
              month={dateCursor.month}
              selectedDate={nextDate}
              markedDates={new Set([nextDate])}
              onSelectDate={(dateKey) => {
                setNextDate(dateKey);
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
