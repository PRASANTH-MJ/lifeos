import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, Chip, LoadingState, ScreenContainer, TextField } from '@/components';
import { formatDisplayDate } from '@/lib/date';
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

  useEffect(() => {
    if (transaction) setNote(transaction.note ?? '');
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
  const category = transaction.category_id ? categories.find((c) => c.id === transaction.category_id) : null;
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';

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
            {isTransfer ? `${account?.name ?? 'Account'} → ${toAccount?.name ?? 'Account'}` : `${category?.name ?? 'Uncategorized'} · ${account?.name ?? ''}`}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{formatDisplayDate(transaction.date)}</Text>
        </View>

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

        <Button label="Delete transaction" variant="danger" onPress={onDelete} />
      </View>
    </ScreenContainer>
  );
}
