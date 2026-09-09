import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Chip, EmptyState, IconBadge, ImportFormatModal, LoadingState, ScreenContainer, showAlert, type ImportFieldSpec } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { loadSampleTransactions } from '@/lib/sampleData';
import {
  formatCurrency,
  formatCurrencyCompact,
  parseTransactionsCsv,
  useAccounts,
  useFinanceCategories,
  useFinanceRecords,
  useTransactions,
  type RecordEntry,
} from '@/modules/finance';
import { useAppTheme } from '@/theme';

const CSV_MIME_TYPES = ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'];

/** Mirrors exactly what modules/finance/importTransactionsCsv.ts reads — keep in sync with that
 * file if its column matching ever changes. */
const TRANSACTIONS_IMPORT_FIELDS: ImportFieldSpec[] = [
  {
    column: 'account',
    aliases: ['accountName'],
    required: true,
    format: 'Text — must match one of your existing account names exactly (case-insensitive).',
    notes: 'Rows with no matching account are skipped, not created.',
    example: 'Checking',
  },
  {
    column: 'amount',
    aliases: ['amt'],
    required: true,
    format: 'Plain positive number, no currency symbol or thousands separator.',
    notes: 'Rows with a missing or non-positive amount are skipped.',
    example: '42.50',
  },
  {
    column: 'type',
    required: false,
    format: 'One of: income, expense, transfer. Defaults to expense if left blank or unrecognized.',
    example: 'expense',
  },
  {
    column: 'category',
    required: false,
    format: "Text — must match one of your existing category names for that row's type (case-insensitive).",
    notes: 'Ignored for transfers. Left uncategorized if it doesn\'t match.',
    example: 'Groceries',
  },
  {
    column: 'date',
    required: false,
    format: 'YYYY-MM-DD, or any date format JavaScript can parse. Defaults to today if blank or unparseable.',
    example: '2026-01-15',
  },
  {
    column: 'note',
    aliases: ['description'],
    required: false,
    format: 'Free text.',
    example: 'Weekly groceries',
  },
];

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
  const [formatModalVisible, setFormatModalVisible] = useState(false);
  const days = RANGE_OPTIONS.find((option) => option.key === range)!.days;
  const { groups, loading, refresh } = useFinanceRecords(days);
  const { accounts, displayCurrency } = useAccounts();
  const { categories } = useFinanceCategories();
  const { addTransaction, removeTransaction } = useTransactions();

  // removeTransaction comes from its own useTransactions() instance, separate from the
  // useFinanceRecords(days) instance this screen actually renders `groups` from — that hook only
  // refetches on screen focus, so without an explicit refresh here a delete wouldn't be reflected
  // in the visible ledger until the user navigated away and back.
  const onDeleteEntry = async (id: string) => {
    await removeTransaction(id);
    await refresh();
  };

  const onImportCsv = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: CSV_MIME_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const file = new File(result.assets[0].uri);
    const text = await file.text();
    const { rows, total, skipped } = parseTransactionsCsv(text, accounts, categories);

    if (rows.length === 0) {
      showAlert('Nothing to import', 'No rows matched an existing account with a valid amount. Make sure your CSV has "account" and "amount" columns.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View CSV format', onPress: () => setFormatModalVisible(true) },
      ]);
      return;
    }

    showAlert(
      `Import ${rows.length} transaction${rows.length === 1 ? '' : 's'}?`,
      skipped > 0 ? `${skipped} of ${total} rows were skipped (missing account or amount).` : `All ${total} rows matched.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            for (const row of rows) {
              await addTransaction(row, { skipDuplicateCheck: true });
            }
            await refresh();
            showAlert('Imported', `Added ${rows.length} transaction${rows.length === 1 ? '' : 's'}.`);
          },
        },
      ]
    );
  };

  const onLoadSampleData = () => {
    showAlert('Load sample transactions?', 'Adds 10 example transactions to your first account so you can see how Records looks with data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Load sample data',
        onPress: async () => {
          const count = await loadSampleTransactions(accounts, categories, addTransaction);
          await refresh();
          if (count > 0) showAlert('Done', `Added ${count} sample transactions.`);
        },
      },
    ]);
  };

  const onMenu = () => {
    showAlert('Records', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'CSV/Excel format', onPress: () => setFormatModalVisible(true) },
      { text: 'Import CSV', onPress: onImportCsv },
      { text: 'Load sample data', onPress: onLoadSampleData },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable hitSlop={8} onPress={onMenu}>
              <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={theme.colors.textSecondary} />
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Records
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Every transaction, with your balance at the time</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
          {RANGE_OPTIONS.map((option) => (
            <Chip key={option.key} label={option.label} selected={range === option.key} onPress={() => setRange(option.key)} />
          ))}
        </ScrollView>

        {groups.length === 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <EmptyState icon="list-outline" title="No transactions in this range" />
            <Pressable onPress={onLoadSampleData} style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Load sample data
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            {groups.map((group) => (
              <Card key={group.monthLabel} tier="panel" style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                      {group.monthLabel}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      Balance {formatCurrency(group.balance, displayCurrency)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: group.sum >= 0 ? theme.colors.success : theme.colors.danger,
                      fontSize: theme.typography.size.sm,
                      fontWeight: theme.typography.weight.semibold,
                    }}>
                    Σ {group.sum >= 0 ? '' : '-'}
                    {formatCurrency(Math.abs(group.sum), displayCurrency)}
                  </Text>
                </View>

                <View style={{ gap: theme.spacing.sm }}>
                  {group.entries.map((entry) => (
                    <RecordRow
                      key={entry.id}
                      entry={entry}
                      accounts={accounts}
                      categories={categories}
                      displayCurrency={displayCurrency}
                      onDelete={onDeleteEntry}
                    />
                  ))}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      <ImportFormatModal
        visible={formatModalVisible}
        onClose={() => setFormatModalVisible(false)}
        title="CSV/Excel import format"
        intro="Build your own file with a header row using these column names (any order, case-insensitive), then import it as CSV or Excel."
        fields={TRANSACTIONS_IMPORT_FIELDS}
      />
    </ScreenContainer>
  );
}

function RecordRow({
  entry,
  accounts,
  categories,
  displayCurrency,
  onDelete,
}: {
  entry: RecordEntry;
  accounts: ReturnType<typeof useAccounts>['accounts'];
  categories: ReturnType<typeof useFinanceCategories>['categories'];
  displayCurrency: string;
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
    showAlert('Delete transaction?', 'This cannot be undone, and will reverse its effect on the account balance.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
    ]);
  };

  const showActions = () => {
    showAlert(isTransfer ? 'Transfer' : (category?.name ?? 'Uncategorized'), formatCurrency(entry.amount, account?.currency), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => router.push({ pathname: '/finance/[id]', params: { id: entry.id } }) },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  return (
    <Link key={entry.id} href={{ pathname: '/finance/[id]', params: { id: entry.id } }} asChild>
      <Pressable onLongPress={showActions}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <IconBadge name={iconName} color={iconColor} />

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
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              ({formatCurrencyCompact(entry.balanceAfter, displayCurrency)})
            </Text>
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
