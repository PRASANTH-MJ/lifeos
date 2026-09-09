import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, ScreenContainer, showAlert } from '@/components';
import { addDays, formatDisplayDate, todayKey } from '@/lib/date';
import {
  FREQUENCY_LABELS,
  cancelPlannedPaymentNotification,
  formatCurrency,
  syncPlannedPaymentNotification,
  useAccounts,
  useFinancePlannedPayments,
} from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function PlannedPaymentsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { plannedPayments, loading, markPaid, removePlannedPayment } = useFinancePlannedPayments();
  const { accounts, displayCurrency } = useAccounts();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  // Display-only rollup for the "next 7 days" summary panel — doesn't touch any stored/derived
  // finance data, just sums what's already loaded for the header card.
  const horizon = addDays(todayKey(), 7);
  const dueSoonTotal = plannedPayments
    .filter((p) => p.next_date <= horizon)
    .reduce((sum, p) => sum + (p.type === 'income' ? p.amount : -p.amount), 0);

  const onMarkPaid = (payment: (typeof plannedPayments)[number]) => {
    showAlert(
      'Mark as paid?',
      `This logs a ${payment.type} of ${formatCurrency(payment.amount, displayCurrency)} today${payment.frequency !== 'once' ? ' and schedules the next occurrence.' : '.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: async () => {
            const nextDate = await markPaid(payment);
            if (nextDate) {
              await syncPlannedPaymentNotification({ ...payment, next_date: nextDate });
            } else {
              await cancelPlannedPaymentNotification(payment.id);
            }
          },
        },
      ]
    );
  };

  const onRemove = (id: string) => {
    showAlert('Delete planned payment?', 'This removes the schedule.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelPlannedPaymentNotification(id);
          await removePlannedPayment(id);
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/finance/planned/new" asChild>
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
            Planned payments
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Known upcoming bills and income</Text>
        </View>

        {plannedPayments.length > 0 ? (
          <Card tier="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium, letterSpacing: 0.5 }}>
                NEXT 7 DAYS
              </Text>
              <Text
                style={{
                  color: dueSoonTotal < 0 ? theme.colors.danger : theme.colors.textPrimary,
                  fontSize: theme.typography.size['2xl'],
                  fontWeight: theme.typography.weight.bold,
                }}>
                {dueSoonTotal < 0 ? '-' : ''}
                {formatCurrency(Math.abs(dueSoonTotal), displayCurrency)}
              </Text>
            </View>
            <IconBadge name="calendar-outline" size="lg" />
          </Card>
        ) : null}

        {plannedPayments.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="Nothing scheduled"
            subtitle="Add a recurring bill or a one-time future payment — it'll remind you and feed the Outlook forecast."
            ctaLabel="Add a planned payment"
            onPressCta={() => router.push('/finance/planned/new')}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {plannedPayments.map((payment) => {
              const account = accounts.find((a) => a.id === payment.account_id);
              const isIncome = payment.type === 'income';
              const semanticColor = isIncome ? theme.colors.success : theme.colors.danger;
              return (
                <Link key={payment.id} href={{ pathname: '/finance/planned/[id]', params: { id: payment.id } }} asChild>
                  <Pressable>
                    <Card tier="elevated" style={{ gap: theme.spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                        <IconBadge name={isIncome ? 'arrow-down-circle' : 'arrow-up-circle'} color={semanticColor} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                            {payment.payee}
                          </Text>
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            {formatDisplayDate(payment.next_date)} · {FREQUENCY_LABELS[payment.frequency]} · {account?.name ?? 'Account'}
                            {payment.is_subscription ? ' · Subscription' : ''}
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
                            {isIncome ? '+' : '-'}
                            {formatCurrency(payment.amount, displayCurrency)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                        <Pressable
                          onPress={() => onMarkPaid(payment)}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            paddingVertical: theme.spacing.sm,
                            borderRadius: theme.radius.md,
                            backgroundColor: theme.colors.primaryMuted,
                          }}>
                          <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                            Mark paid
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(payment.id)} hitSlop={8} style={{ justifyContent: 'center', paddingHorizontal: theme.spacing.sm }}>
                          <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                        </Pressable>
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
