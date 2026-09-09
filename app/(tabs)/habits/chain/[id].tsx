import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, IconBadge, LoadingState, ProgressBar, ScreenContainer, showAlert } from '@/components';
import { resolveChainHabits, useHabitChains, useHabits } from '@/modules/habits';
import { useAppTheme } from '@/theme';

/** Chain view: the ordered sequence of member habits with today's check-off progress. Checking a
 * step off calls the exact same toggleToday/upsertLog useHabits already uses for that habit's own
 * daily check-in (no separate chain-progress storage) — so ticking a habit off here also shows it
 * done on the regular Habits list, and vice versa. */
export default function ChainDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chainId = Number(id);

  const { chains, loading: chainsLoading, removeChain } = useHabitChains();
  const { habits, loading: habitsLoading, toggleToday, upsertLog } = useHabits();

  const chain = chains.find((c) => c.id === chainId);
  const habitsBySyncId = new Map(habits.map(({ habit }) => [habit.sync_id, habit]));

  if (chainsLoading || habitsLoading || !chain) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const steps = resolveChainHabits(chain, habitsBySyncId as Map<string, (typeof habits)[number]['habit']>);
  const resolvedSteps = steps.filter((s): s is { habit: NonNullable<typeof s.habit>; missing: false } => !s.missing);
  const entryByHabitId = new Map(habits.map((entry) => [entry.habit.id, entry]));
  const doneCount = resolvedSteps.filter((s) => entryByHabitId.get(s.habit.id)?.todayLog?.status === 'done').length;

  const onDelete = () => {
    showAlert('Delete chain?', 'This removes the chain, not the habits in it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeChain(chain.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: chain.name }} />
      <View style={{ gap: theme.spacing.xl }}>
        <Card tier="panel" style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            {chain.name}
          </Text>
          <ProgressBar progress={steps.length > 0 ? doneCount / steps.length : 0} color={theme.colors.moduleHabits} />
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {doneCount}/{steps.length} done today
          </Text>
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          {steps.map((step, index) => {
            if (step.missing) {
              return (
                <Card key={`missing-${step.syncId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, opacity: 0.6 }}>
                  <Text style={{ width: 18, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {index + 1}
                  </Text>
                  <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontStyle: 'italic' }}>
                    Habit no longer exists
                  </Text>
                </Card>
              );
            }
            const entry = entryByHabitId.get(step.habit.id);
            const completedToday = entry?.todayLog?.status === 'done';
            return (
              <Card key={step.habit.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }, completedToday ? { opacity: 0.7 } : null]}>
                <Text style={{ width: 18, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                  {index + 1}
                </Text>
                <IconBadge name={step.habit.icon as never} color={theme.colors.moduleHabits} size="sm" />
                <Text
                  style={{
                    flex: 1,
                    color: theme.colors.textPrimary,
                    fontSize: theme.typography.size.sm,
                    fontWeight: theme.typography.weight.medium,
                    textDecorationLine: completedToday ? 'line-through' : 'none',
                  }}
                  numberOfLines={1}>
                  {step.habit.name}
                </Text>
                <Pressable
                  accessibilityLabel={`Mark ${step.habit.name} done`}
                  onPress={() => (step.habit.tracking_type === 'yesno' ? toggleToday(step.habit) : upsertLog(step.habit.id, { status: completedToday ? 'skip' : 'done' }))}
                  hitSlop={8}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: theme.radius.full,
                    borderWidth: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderColor: completedToday ? theme.colors.success : theme.colors.border,
                    backgroundColor: completedToday ? theme.colors.success : 'transparent',
                  }}>
                  {completedToday ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </Pressable>
              </Card>
            );
          })}
        </View>

        <Pressable onPress={onDelete}>
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm, textAlign: 'center' }}>Delete chain</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
