import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, ScreenContainer } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import {
  formatCurrency,
  formatCurrencyCompact,
  useAccounts,
  useFinanceCategories,
  useFinanceRecords,
  useTransactions,
  type RecordEntry,
} from '@/modules/finance';
import { useAppTheme } from '@/theme';

const RANGE_OPTIONS = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '12w', label: '12W', days: 84 },
  { key: '6m', label: '6M', days: 182 },
  { key: '1y', label: '1Y', days: 365 },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]['key'];

export default function RecordsScreen() {
  const theme = useAppTheme();
  const [range, setRange] = useState<RangeKey>('1y');
  const days = RANGE_OPTIONS.find((option) => option.key === range)!.days;
  const { groups, loading } = useFinanceRecords(days);
  const { accounts } = useAccounts();
  const { categories } = useFinanceCategories();
  const { removeTransaction } = useTransactions();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Records
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Every transaction, with your balance at the time</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {RANGE_OPTIONS.map((option) => (
            <Pressable key={option.key} style={{ flex: 1 }} onPress={() => setRange(option.key)}>
              <View
                style={{
                  alignItems: 'center',
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.md,
                  backgroundColor: range === option.key ? theme.colors.primaryMuted : theme.colors.surface,
                  borderWidth: 1,
                  borderColor: range === option.key ? theme.colors.primary : theme.colors.border,
                }}>
                <Text
                  style={{
                    color: range === option.key ? theme.colors.primary : theme.colors.textSecondary,
                    fontSize: theme.typography.size.sm,
                    fontWeight: theme.typography.weight.medium,
                  }}>
                  {option.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {groups.length === 0 ? (
          <EmptyState icon="list-outline" title="No transactions in this range" />
        ) : (
          <View style={{ gap: theme.spacing.xl }}>
            {groups.map((group) => (
              <View key={group.monthLabel} style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                      {group.monthLabel}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Balance {formatCurrency(group.balance)}</Text>
                  </View>
                  <Text
                    style={{
                      color: group.sum >= 0 ? theme.colors.success : theme.colors.danger,
                      fontSize: theme.typography.size.sm,
                      fontWeight: theme.typography.weight.semibold,
                    }}>
                    Σ {group.sum >= 0 ? '' : '-'}
                    {formatCurrency(Math.abs(group.sum))}
                  </Text>
                </View>

                <View style={{ gap: theme.spacing.sm }}>
                  {group.entries.map((entry) => (
                    <RecordRow
                      key={entry.id}
                      entry={entry}
                      accounts={accounts}
                      categories={categories}
                      onDelete={removeTransaction}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

function RecordRow({
  entry,
  accounts,
  categories,
  onDelete,
}: {
  entry: RecordEntry;
  accounts: ReturnType<typeof useAccounts>['accounts'];
  categories: ReturnType<typeof useFinanceCategories>['categories'];
  onDelete: (id: string) => Promise<void>;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const account = accounts.find((a) => a.id === entry.account_id);
  const toAccount = entry.to_account_id ? accounts.find((a) => a.id === entry.to_account_id) : null;
  const category = entry.category_id ? categories.find((c) => c.id === entry.category_id) : null;
  const isIncome = entry.type === 'income';
  const isTransfer = entry.type === 'transfer';

  const iconColor = isTransfer ? theme.colors.primary : (category?.color ?? '#8E8E93');
  const iconName = isTransfer ? 'swap-horizontal' : ((category?.icon ?? 'pricetag') as never);

  const confirmDelete = () => {
    Alert.alert('Delete transaction?', 'This cannot be undone, and will reverse its effect on the account balance.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
    ]);
  };

  const showActions = () => {
    Alert.alert(isTransfer ? 'Transfer' : (category?.name ?? 'Uncategorized'), formatCurrency(entry.amount, account?.currency), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => router.push({ pathname: '/finance/[id]', params: { id: entry.id } }) },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  return (
    <Link key={entry.id} href={{ pathname: '/finance/[id]', params: { id: entry.id } }} asChild>
      <Pressable onLongPress={showActions}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View style={{ width: 40, height: 40 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: `${iconColor}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: theme.colors.success,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.colors.surface,
              }}>
              <Ionicons name="checkmark" size={8} color="#FFFFFF" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
              {isTransfer ? 'Transfer' : (category?.name ?? 'Uncategorized')}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }} numberOfLines={1}>
              {isTransfer ? `${account?.name ?? 'Account'} → ${toAccount?.name ?? 'Account'}` : (account?.name ?? '')}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                color: isTransfer ? theme.colors.textPrimary : isIncome ? theme.colors.success : theme.colors.danger,
                fontSize: theme.typography.size.base,
                fontWeight: theme.typography.weight.semibold,
              }}>
              {isTransfer ? '' : isIncome ? '+' : '-'}
              {formatCurrency(entry.amount, account?.currency)}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>({formatCurrencyCompact(entry.balanceAfter)})</Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDate(entry.date)}</Text>
          </View>

          <Pressable hitSlop={10} onPress={showActions}>
            <Ionicons name="ellipsis-vertical" size={16} color={theme.colors.textTertiary} />
          </Pressable>
        </Card>
      </Pressable>
    </Link>
  );
}
