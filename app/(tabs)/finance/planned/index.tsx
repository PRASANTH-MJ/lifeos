import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, ScreenContainer } from '@/components';
import { formatDisplayDate } from '@/lib/date';
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
  const { accounts } = useAccounts();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onMarkPaid = (payment: (typeof plannedPayments)[number]) => {
    Alert.alert(
      'Mark as paid?',
      `This logs a ${payment.type} of ${formatCurrency(payment.amount)} today${payment.frequency !== 'once' ? ' and schedules the next occurrence.' : '.'}`,
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

  const onRemove = async (id: string) => {
    await cancelPlannedPaymentNotification(id);
    await removePlannedPayment(id);
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
              return (
                <Card key={payment.id} style={{ gap: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <Ionicons
                      name={isIncome ? 'arrow-down-circle' : 'arrow-up-circle'}
                      size={22}
                      color={isIncome ? theme.colors.success : theme.colors.danger}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                        {payment.payee}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        {formatDisplayDate(payment.next_date)} · {FREQUENCY_LABELS[payment.frequency]} · {account?.name ?? 'Account'}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: isIncome ? theme.colors.success : theme.colors.danger,
                        fontSize: theme.typography.size.base,
                        fontWeight: theme.typography.weight.semibold,
                      }}>
                      {isIncome ? '+' : '-'}
                      {formatCurrency(payment.amount)}
                    </Text>
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
              );
            })}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
