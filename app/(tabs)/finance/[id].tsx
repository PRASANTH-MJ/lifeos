import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, LoadingState, ScreenContainer, TextField } from '@/components';
import { formatDisplayDate, monthCursorOf, shiftMonth } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { formatCurrency, useAccounts, useFinanceCategories, useFinanceLabels, useTransactionLabels, useTransactions } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function TransactionDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, loading, editTransaction, removeTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { categories } = useFinanceCategories();
  const { labels } = useFinanceLabels();
  const { labelIds, setLabelsFor } = useTransactionLabels(id ?? null);

  const transaction = transactions.find((t) => t.id === id);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(new Date().toISOString().slice(0, 10)));

  useEffect(() => {
    if (transaction) {
      setNote(transaction.note ?? '');
      setAmount(String(transaction.amount));
      setDate(transaction.date);
      setCategoryId(transaction.category_id);
    }
  }, [transaction]);

  if (loading || !transaction) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onDelete = () => {
    Alert.alert('Delete transaction?', 'This cannot be undone, and will reverse its effect on the account balance.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeTransaction(transaction.id);
          router.back();
        },
      },
    ]);
  };

  const account = accounts.find((a) => a.id === transaction.account_id);
  const toAccount = transaction.to_account_id ? accounts.find((a) => a.id === transaction.to_account_id) : null;
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const relevantCategories = categories.filter((c) => c.type === transaction.type);

  const numericAmount = Number(amount);
  const commitAmount = () => {
    if (numericAmount > 0 && numericAmount !== transaction.amount) editTransaction(transaction.id, { amount: numericAmount });
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text
            style={{
              color: isIncome ? theme.colors.success : theme.colors.textPrimary,
              fontSize: theme.typography.size['3xl'],
              fontWeight: theme.typography.weight.bold,
            }}>
            {isIncome ? '+' : isTransfer ? '' : '-'}
            {formatCurrency(transaction.amount, account?.currency)}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base }}>
            {isTransfer ? `${account?.name ?? 'Account'} → ${toAccount?.name ?? 'Account'}` : `${account?.name ?? ''}`}
          </Text>
        </View>

        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          onBlur={commitAmount}
          keyboardType="decimal-pad"
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Date</Text>
          <Chip
            label={formatDisplayDate(date)}
            selected
            onPress={() => {
              setDateCursor(monthCursorOf(date));
              setDatePickerVisible(true);
            }}
          />
        </View>

        {!isTransfer ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Category
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {relevantCategories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  selected={categoryId === cat.id}
                  onPress={() => {
                    setCategoryId(cat.id);
                    editTransaction(transaction.id, { categoryId: cat.id });
                  }}
                  color={cat.color}
                />
              ))}
            </View>
          </View>
        ) : null}

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          onBlur={() => note !== (transaction.note ?? '') && editTransaction(transaction.id, { note: note.trim() || null })}
          placeholder="Add a note"
        />

        {labels.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Labels
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {labels.map((label) => (
                <Chip
                  key={label.id}
                  label={label.name}
                  selected={labelIds.includes(label.id)}
                  onPress={() =>
                    setLabelsFor(transaction.id, labelIds.includes(label.id) ? labelIds.filter((l) => l !== label.id) : [...labelIds, label.id])
                  }
                  color={label.color}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
          To change the account or type, delete this transaction and log a new one.
        </Text>

        <Button label="Delete transaction" variant="danger" onPress={onDelete} />
      </View>

      <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
          <Card style={{ borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, gap: theme.spacing.lg }}>
            <CalendarMonthGrid
              year={dateCursor.year}
              month={dateCursor.month}
              selectedDate={date}
              markedDates={new Set([date])}
              onSelectDate={(selected) => {
                setDate(selected);
                setDatePickerVisible(false);
                if (selected !== transaction.date) editTransaction(transaction.id, { date: selected });
              }}
              onChangeMonth={(delta) => setDateCursor((cursor) => shiftMonth(cursor, delta))}
            />
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
