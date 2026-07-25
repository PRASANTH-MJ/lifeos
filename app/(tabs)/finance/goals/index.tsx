import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, ScreenContainer } from '@/components';
import { formatCurrency, useFinanceGoals } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function GoalsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { goals, loading } = useFinanceGoals();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/finance/goals/new" asChild>
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
            Goals
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>How much have I already saved?</Text>
        </View>

        {goals.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="No goals yet"
            subtitle="Set a savings target — a new vehicle, an emergency fund, anything you're saving toward."
            ctaLabel="Add your first goal"
            onPressCta={() => router.push('/finance/goals/new')}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {goals.map((goal) => {
              const progress = Math.min(goal.current_amount / goal.target_amount, 1);
              return (
                <Link key={goal.id} href={{ pathname: '/finance/goals/[id]', params: { id: goal.id } }} asChild>
                  <Pressable>
                    <Card style={{ gap: theme.spacing.sm, opacity: goal.is_closed ? 0.6 : 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: theme.radius.md,
                            backgroundColor: `${goal.color}22`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Ionicons name={goal.icon as never} size={19} color={goal.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                            {goal.name}
                          </Text>
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
                          </Text>
                        </View>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                          {Math.round(progress * 100)}%
                        </Text>
                      </View>
                      <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
                        <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: goal.color }} />
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
