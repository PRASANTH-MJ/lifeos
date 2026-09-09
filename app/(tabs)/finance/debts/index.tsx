import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, RangeChip, ScreenContainer } from '@/components';
import { formatCurrency, useAccounts, useFinanceDebts } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function DebtsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { debts, remainingById, loading } = useFinanceDebts();
  const { displayCurrency } = useAccounts();
  const [tab, setTab] = useState<'active' | 'closed'>('active');

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const filtered = debts.filter((d) => (tab === 'active' ? !d.is_closed : d.is_closed));

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/finance/debts/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Debts
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Track what you lent and borrowed</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <RangeChip label="Active" selected={tab === 'active'} onPress={() => setTab('active')} />
          <RangeChip label="Closed" selected={tab === 'closed'} onPress={() => setTab('closed')} />
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            icon="hand-left-outline"
            title={tab === 'active' ? 'Nothing active' : 'No closed debts'}
            subtitle={tab === 'active' ? 'Tap the + button to log money you lent or borrowed.' : undefined}
            ctaLabel={tab === 'active' ? 'Add a debt' : undefined}
            onPressCta={tab === 'active' ? () => router.push('/finance/debts/new') : undefined}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {filtered.map((debt) => {
              const remaining = remainingById[debt.id] ?? debt.amount;
              const isLent = debt.direction === 'lent';
              const semanticColor = isLent ? theme.colors.success : theme.colors.danger;
              return (
                <Link key={debt.id} href={{ pathname: '/finance/debts/[id]', params: { id: debt.id } }} asChild>
                  <Pressable>
                    <Card tier="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <IconBadge name={isLent ? 'arrow-up-circle' : 'arrow-down-circle'} color={semanticColor} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                          {debt.person_name}
                        </Text>
                        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                          {isLent ? 'You lent' : 'You borrowed'} {formatCurrency(debt.amount, displayCurrency)}
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: theme.spacing.sm,
                          paddingVertical: 4,
                          borderRadius: theme.radius.full,
                          backgroundColor: `${semanticColor}22`,
                        }}>
                        <Text
                          style={{
                            color: semanticColor,
                            fontSize: theme.typography.size.sm,
                            fontWeight: theme.typography.weight.semibold,
                          }}>
                          {formatCurrency(remaining, displayCurrency)}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
