import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, LoadingState, ScreenContainer, TextField } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { formatCurrency, useTransactionDetail } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function TransactionDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactionId = Number(id);
  const { transaction, loading, updateTransaction, deleteTransaction } = useTransactionDetail(transactionId);

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
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction();
          router.back();
        },
      },
    ]);
  };

  const isIncome = transaction.type === 'income';

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
            {isIncome ? '+' : '-'}
            {formatCurrency(transaction.amount)}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base }}>
            {transaction.category} · {formatDisplayDate(transaction.date)}
          </Text>
        </View>

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          onBlur={() => note !== (transaction.note ?? '') && updateTransaction({ note: note.trim() || null })}
          placeholder="Add a note"
        />

        <Button label="Delete transaction" variant="danger" onPress={onDelete} />
      </View>
    </ScreenContainer>
  );
}
