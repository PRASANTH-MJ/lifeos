import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, ScreenContainer, TextField } from '@/components';
import { addDays, formatDisplayDate, todayKey } from '@/lib/date';
import { categoriesFor, useFinanceMonth, type TransactionType } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function NewTransactionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const today = todayKey();
  const [year, month] = today.split('-').map(Number);
  const { createTransaction } = useFinanceMonth(year, month - 1);

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categoriesFor('expense')[0]);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const onChangeType = (nextType: TransactionType) => {
    setType(nextType);
    setCategory(categoriesFor(nextType)[0]);
  };

  const parsedAmount = Number(amount);
  const canSave = amount.trim().length > 0 && !Number.isNaN(parsedAmount) && parsedAmount > 0;

  const onSave = async () => {
    setSaving(true);
    await createTransaction({ type, amount: parsedAmount, category, note: note.trim() || undefined, date });
    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Chip label="Expense" selected={type === 'expense'} onPress={() => onChangeType('expense')} color={theme.colors.danger} mutedColor={theme.colors.dangerMuted} />
          <Chip label="Income" selected={type === 'income'} onPress={() => onChangeType('income')} color={theme.colors.success} mutedColor={theme.colors.successMuted} />
        </View>

        <TextField label="Amount" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Category
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {categoriesFor(type).map((option) => (
              <Chip key={option} label={option} selected={category === option} onPress={() => setCategory(option)} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Date
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip label="Today" selected={date === today} onPress={() => setDate(today)} />
            <Chip label="Yesterday" selected={date === addDays(today, -1)} onPress={() => setDate(addDays(today, -1))} />
          </View>
          {date !== today && date !== addDays(today, -1) ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDate(date)}</Text>
          ) : null}
        </View>

        <TextField label="Note (optional)" placeholder="Add a note" value={note} onChangeText={setNote} />

        <Button label="Save transaction" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
