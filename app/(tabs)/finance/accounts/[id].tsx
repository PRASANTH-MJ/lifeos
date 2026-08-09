import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, Chip, LoadingState, ScreenContainer, TextField } from '@/components';
import { ACCOUNT_TYPE_LABELS, useAccounts, type AccountType } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const ACCOUNT_TYPES: AccountType[] = ['cash', 'general', 'investment', 'credit'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

export default function AccountDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, editAccount, removeAccount } = useAccounts();

  const account = accounts.find((a) => a.id === id);

  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'cash');
  const [currency, setCurrency] = useState(account?.currency ?? 'USD');
  const [saving, setSaving] = useState(false);

  if (!account) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const canSave = name.trim().length > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      await editAccount(account.id, { name: name.trim(), type, currency });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete account?', 'This removes the account. Transactions already logged against it are not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeAccount(account.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: account.name }} />
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="Account name" value={name} onChangeText={setName} autoFocus />

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

        <Button label="Save changes" onPress={onSave} disabled={!canSave} loading={saving} />
        <Button label="Delete account" variant="danger" onPress={onDelete} />
      </View>
    </ScreenContainer>
  );
}
