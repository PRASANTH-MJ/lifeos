import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Chip, IconBadge, LoadingState, ScreenContainer, TextField, showAlert } from '@/components';
import { ACCOUNT_TYPE_LABELS, useAccounts, type AccountType } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const ACCOUNT_TYPES: AccountType[] = ['cash', 'general', 'investment', 'credit'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];
const TYPE_ICON: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  general: 'wallet-outline',
  investment: 'trending-up-outline',
  credit: 'card-outline',
};

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
    showAlert('Delete account?', 'This permanently deletes the account and every transaction logged against it. This cannot be undone.', [
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
        <Card tier="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <IconBadge name={TYPE_ICON[type]} color={theme.colors.primary} size="lg" />
          <View>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {account.name}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
              {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
            </Text>
          </View>
        </Card>

        <TextField label="Bank name" value={name} onChangeText={setName} autoFocus />

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
