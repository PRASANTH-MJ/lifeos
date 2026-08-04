import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, ScreenContainer, TextField } from '@/components';
import { ACCOUNT_TYPE_LABELS, useAccounts, type AccountType } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const ACCOUNT_TYPES: AccountType[] = ['cash', 'general', 'investment', 'credit'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

export default function NewAccountScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { addAccount } = useAccounts();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [currency, setCurrency] = useState('USD');
  const [startingBalance, setStartingBalance] = useState('');
  const [saving, setSaving] = useState(false);

  // Static route — expo-router reuses the same screen instance across repeated visits rather
  // than mounting a fresh one each time, so a plain useState default only resets once, ever.
  useFocusEffect(
    useCallback(() => {
      setName('');
      setType('cash');
      setCurrency('USD');
      setStartingBalance('');
    }, [])
  );

  const canSave = name.trim().length > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      await addAccount({
        name: name.trim(),
        type,
        currency,
        currentBalance: startingBalance.trim() ? Number(startingBalance) : 0,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="Account name" placeholder="e.g. SBI Bank" value={name} onChangeText={setName} autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Type
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {ACCOUNT_TYPES.map((option) => (
              <Chip key={option} label={ACCOUNT_TYPE_LABELS[option]} selected={type === option} onPress={() => setType(option)} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Currency
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {CURRENCIES.map((option) => (
              <Chip key={option} label={option} selected={currency === option} onPress={() => setCurrency(option)} />
            ))}
          </View>
        </View>

        <TextField label="Starting balance (optional)" placeholder="0.00" value={startingBalance} onChangeText={setStartingBalance} keyboardType="decimal-pad" />

        <Button label="Save account" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
