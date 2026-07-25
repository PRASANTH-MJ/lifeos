import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, EmptyState, ScreenContainer, TextField } from '@/components';
import { addDays, todayKey } from '@/lib/date';
import { useAccounts, useFinanceCategories, useFinanceLabels, useTransactionLabels, useTransactions, type TransactionType } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const QUICK_DATES = [
  { label: 'Today', value: todayKey() },
  { label: 'Yesterday', value: addDays(todayKey(), -1) },
];

export default function NewTransactionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { accounts, loading: loadingAccounts } = useAccounts();
  const { categories } = useFinanceCategories();
  const { addTransaction } = useTransactions();
  const { labels } = useFinanceLabels();
  const { setLabelsFor } = useTransactionLabels(null);

  const [type, setType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (!loadingAccounts && accounts.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="wallet-outline"
          title="Add an account first"
          subtitle="You need at least one account before logging a transaction."
          ctaLabel="Add an account"
          onPressCta={() => router.replace('/finance/accounts/new')}
        />
      </ScreenContainer>
    );
  }

  const relevantCategories = categories.filter((c) => c.type === type);
  const numericAmount = Number(amount);
  const canSave = numericAmount > 0 && Boolean(accountId) && (type !== 'transfer' || Boolean(toAccountId && toAccountId !== accountId));

  const onSave = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      const transactionId = await addTransaction({
        accountId,
        toAccountId: type === 'transfer' ? toAccountId : null,
        categoryId: type === 'transfer' ? null : categoryId,
        type,
        amount: numericAmount,
        date,
        note: note.trim() || null,
      });
      if (selectedLabelIds.length > 0) {
        await setLabelsFor(transactionId, selectedLabelIds);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const toggleLabel = (id: string) => {
    setSelectedLabelIds((current) => (current.includes(id) ? current.filter((l) => l !== id) : [...current, id]));
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((option) => (
            <Chip
              key={option}
              label={option.charAt(0).toUpperCase() + option.slice(1)}
              selected={type === option}
              onPress={() => {
                setType(option);
                setCategoryId(null);
              }}
              color={option === 'income' ? theme.colors.success : option === 'expense' ? theme.colors.danger : theme.colors.primary}
              mutedColor={option === 'income' ? theme.colors.successMuted : option === 'expense' ? theme.colors.dangerMuted : theme.colors.primaryMuted}
            />
          ))}
        </View>

        <TextField label="Amount" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {type === 'transfer' ? 'From account' : 'Account'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {accounts.map((account) => (
              <Chip key={account.id} label={account.name} selected={accountId === account.id} onPress={() => setAccountId(account.id)} />
            ))}
          </View>
        </View>

        {type === 'transfer' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              To account
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((account) => (
                  <Chip key={account.id} label={account.name} selected={toAccountId === account.id} onPress={() => setToAccountId(account.id)} />
                ))}
            </View>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Category
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {relevantCategories.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  selected={categoryId === category.id}
                  onPress={() => setCategoryId(category.id)}
                  color={category.color}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Date</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {QUICK_DATES.map((option) => (
              <Chip key={option.label} label={option.label} selected={date === option.value} onPress={() => setDate(option.value)} />
            ))}
          </View>
        </View>

        <TextField label="Note (optional)" placeholder="Add a note" value={note} onChangeText={setNote} />

        {labels.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Labels (optional)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {labels.map((label) => (
                <Chip
                  key={label.id}
                  label={label.name}
                  selected={selectedLabelIds.includes(label.id)}
                  onPress={() => toggleLabel(label.id)}
                  color={label.color}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Button label="Save transaction" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
