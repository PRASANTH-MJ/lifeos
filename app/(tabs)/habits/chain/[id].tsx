import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, IconBadge, LoadingState, ProgressBar, ScreenContainer, showAlert } from '@/components';
import { parseChainTaskSyncIds, resolveChainHabits, useHabitChains, useHabits } from '@/modules/habits';
import { useRecurringTasks } from '@/modules/tasks';
import { useAppTheme } from '@/theme';

/** Chain (Routine) view: the ordered sequence of member habits, then recurring tasks, each with
 * today's check-off progress. Checking a habit step off calls the exact same toggleToday/upsertLog
 * useHabits already uses for that habit's own daily check-in (no separate chain-progress storage)
 * — so ticking a habit off here also shows it done on the regular Habits list, and vice versa.
 * Checking a task step off works the same way through useRecurringTasks' upsertCompletion/
 * clearCompletion. Habits and tasks render as two separate ordered sections rather than one
 * interleaved list — see chain-new.tsx's doc comment for why that's what's actually stored. */
export default function ChainDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chainId = Number(id);

  const { chains, loading: chainsLoading, removeChain } = useHabitChains();
  const { habits, loading: habitsLoading, toggleToday, upsertLog } = useHabits();
  const { tasks: recurringTasks, loading: tasksLoading, upsertCompletion, clearCompletion } = useRecurringTasks();

  const chain = chains.find((c) => c.id === chainId);
  const habitsBySyncId = new Map(habits.map(({ habit }) => [habit.sync_id, habit]));
  const taskEntryBySyncId = new Map(recurringTasks.map((entry) => [entry.task.sync_id, entry]));

  if (chainsLoading || habitsLoading || tasksLoading || !chain) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const habitSteps = resolveChainHabits(chain, habitsBySyncId as Map<string, (typeof habits)[number]['habit']>);
  const resolvedHabitSteps = habitSteps.filter((s): s is { habit: NonNullable<typeof s.habit>; missing: false } => !s.missing);
  const entryByHabitId = new Map(habits.map((entry) => [entry.habit.id, entry]));
  const habitDoneCount = resolvedHabitSteps.filter((s) => entryByHabitId.get(s.habit.id)?.todayLog?.status === 'done').length;

  const taskSyncIds = parseChainTaskSyncIds(chain.task_sync_ids);
  const taskSteps = taskSyncIds.map((syncId) => {
    const entry = taskEntryBySyncId.get(syncId);
    return entry ? { entry, missing: false as const } : { entry: null, missing: true as const, syncId };
  });
  const taskDoneCount = taskSteps.filter((s) => !s.missing && s.entry.todayLog?.status === 'done').length;

  const totalSteps = habitSteps.length + taskSteps.length;
  const totalDone = habitDoneCount + taskDoneCount;

  const onDelete = () => {
    showAlert('Delete routine?', 'This removes the routine, not the habits or tasks in it.', [
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
          <ProgressBar progress={totalSteps > 0 ? totalDone / totalSteps : 0} color={theme.colors.moduleHabits} />
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {totalDone}/{totalSteps} done today
          </Text>
        </Card>

        {habitSteps.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            {habitSteps.map((step, index) => {
              if (step.missing) {
                return (
                  <Card key={`missing-habit-${step.syncId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, opacity: 0.6 }}>
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
        ) : null}

        {taskSteps.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Recurring tasks
            </Text>
            {taskSteps.map((step, index) => {
              if (step.missing) {
                return (
                  <Card key={`missing-task-${step.syncId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, opacity: 0.6 }}>
                    <Text style={{ width: 18, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                      {index + 1}
                    </Text>
                    <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontStyle: 'italic' }}>
                      Task no longer exists
                    </Text>
                  </Card>
                );
              }
              const { task, todayLog } = step.entry;
              const completedToday = todayLog?.status === 'done';
              return (
                <Card key={task.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }, completedToday ? { opacity: 0.7 } : null]}>
                  <Text style={{ width: 18, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {index + 1}
                  </Text>
                  <IconBadge name="checkbox-outline" color={theme.colors.moduleTasks} size="sm" />
                  <Text
                    style={{
                      flex: 1,
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.size.sm,
                      fontWeight: theme.typography.weight.medium,
                      textDecorationLine: completedToday ? 'line-through' : 'none',
                    }}
                    numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Mark ${task.title} done`}
                    onPress={() => (completedToday ? clearCompletion(task.id) : upsertCompletion(task.id, { status: 'done' }))}
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
        ) : null}

        <Pressable onPress={onDelete}>
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm, textAlign: 'center' }}>Delete routine</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
