import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, ScreenContainer, TextField } from '@/components';
import { monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import {
  FREQUENCY_LABELS,
  syncPlannedPaymentNotification,
  useAccounts,
  useFinanceCategories,
  useFinancePlannedPayments,
  type PlannedPaymentFrequency,
  type TransactionType,
} from '@/modules/finance';
import { useAppTheme } from '@/theme';

const FREQUENCIES: PlannedPaymentFrequency[] = ['once', 'weekly', 'monthly', 'yearly'];

export default function NewPlannedPaymentScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { accounts, loading: loadingAccounts } = useAccounts();
  const { categories } = useFinanceCategories();
  const { addPlannedPayment } = useFinancePlannedPayments();

  const [type, setType] = useState<Exclude<TransactionType, 'transfer'>>('expense');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [frequency, setFrequency] = useState<PlannedPaymentFrequency>('monthly');
  const [nextDate, setNextDate] = useState(todayKey());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(nextDate));
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!loadingAccounts && accounts.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="wallet-outline"
          title="Add an account first"
          subtitle="You need at least one account before scheduling a planned payment."
          ctaLabel="Add an account"
          onPressCta={() => router.replace('/finance/accounts/new')}
        />
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
      const id = await addPlannedPayment({
        accountId,
        categoryId,
        type,
        amount: numericAmount,
        payee: payee.trim(),
        frequency,
        nextDate,
        notify,
        note: note.trim() || null,
      });
      await syncPlannedPaymentNotification({ id, payee: payee.trim(), amount: numericAmount, next_date: nextDate, notify, type });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
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

        <TextField label="Payee" placeholder="e.g. Rent, Netflix" value={payee} onChangeText={setPayee} autoFocus />
        <TextField label="Amount" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

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
            Remind me
          </Text>
          <Switch value={notify} onValueChange={setNotify} />
        </View>

        <TextField label="Note (optional)" placeholder="Add a note" value={note} onChangeText={setNote} />

        <Button label="Save" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>

      <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
          <Card style={{ borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, gap: theme.spacing.lg }}>
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
