import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, IconBadge, ScreenContainer, TextField } from '@/components';
import { useHabitChains, useHabits } from '@/modules/habits';
import { useRecurringTasks } from '@/modules/tasks';
import { useAppTheme } from '@/theme';

/** "Create chain" flow — pick from the user's existing habits AND recurring tasks, then order each
 * group with up/down arrows (this app has no drag-reorder pattern elsewhere — see moveHabit/
 * moveRecurringTask, both button-based — so this stays consistent with that rather than
 * introducing drag-and-drop). Habits and recurring tasks are two separate ordered lists under the
 * hood (habit_chains.habit_sync_ids / task_sync_ids) since checking each off goes through a
 * different hook (useHabits vs. useRecurringTasks) — the Routine screen renders them as two
 * sections rather than claiming a single interleaved order that isn't actually stored. */
export default function CreateChainScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { habits } = useHabits();
  const { tasks: recurringTasks } = useRecurringTasks();
  const { createChain } = useHabitChains();

  const [name, setName] = useState('');
  const [orderedHabitSyncIds, setOrderedHabitSyncIds] = useState<string[]>([]);
  const [orderedTaskSyncIds, setOrderedTaskSyncIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleHabit = (syncId: string | null) => {
    if (!syncId) return;
    setOrderedHabitSyncIds((ids) => (ids.includes(syncId) ? ids.filter((id) => id !== syncId) : [...ids, syncId]));
  };

  const toggleTask = (syncId: string | null) => {
    if (!syncId) return;
    setOrderedTaskSyncIds((ids) => (ids.includes(syncId) ? ids.filter((id) => id !== syncId) : [...ids, syncId]));
  };

  const moveHabitEntry = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    setOrderedHabitSyncIds((ids) => {
      if (swapIndex < 0 || swapIndex >= ids.length) return ids;
      const next = [...ids];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const moveTaskEntry = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    setOrderedTaskSyncIds((ids) => {
      if (swapIndex < 0 || swapIndex >= ids.length) return ids;
      const next = [...ids];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const habitBySyncId = new Map(habits.map(({ habit }) => [habit.sync_id, habit]));
  const taskBySyncId = new Map(recurringTasks.map(({ task }) => [task.sync_id, task]));
  const totalPicked = orderedHabitSyncIds.length + orderedTaskSyncIds.length;
  const canSave = name.trim().length > 0 && totalPicked >= 2;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createChain(name.trim(), orderedHabitSyncIds, orderedTaskSyncIds);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (habits.length === 0 && recurringTasks.length === 0) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'New Routine' }} />
        <EmptyState
          icon="link-outline"
          title="No habits or recurring tasks yet"
          subtitle="Add a couple of habits or recurring tasks first, then come back to group them into a routine."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'New Routine' }} />
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="Routine name" placeholder="e.g. Morning routine" value={name} onChangeText={setName} autoFocus />

        {orderedHabitSyncIds.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Habits (in order)
            </Text>
            {orderedHabitSyncIds.map((syncId, index) => {
              const habit = habitBySyncId.get(syncId);
              if (!habit) return null;
              return (
                <Card key={syncId} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Text style={{ width: 18, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {index + 1}
                  </Text>
                  <IconBadge name={habit.icon as never} color={theme.colors.moduleHabits} size="sm" />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }} numberOfLines={1}>
                    {habit.name}
                  </Text>
                  <View style={{ alignItems: 'center' }}>
                    <Pressable accessibilityLabel={`Move ${habit.name} up`} onPress={() => moveHabitEntry(index, 'up')} disabled={index === 0} hitSlop={6}>
                      <Ionicons name="chevron-up" size={16} color={index === 0 ? theme.colors.border : theme.colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Move ${habit.name} down`}
                      onPress={() => moveHabitEntry(index, 'down')}
                      disabled={index === orderedHabitSyncIds.length - 1}
                      hitSlop={6}>
                      <Ionicons name="chevron-down" size={16} color={index === orderedHabitSyncIds.length - 1 ? theme.colors.border : theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                  <Pressable accessibilityLabel={`Remove ${habit.name} from routine`} onPress={() => toggleHabit(syncId)} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={20} color={theme.colors.textTertiary} />
                  </Pressable>
                </Card>
              );
            })}
          </View>
        ) : null}

        {orderedTaskSyncIds.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Recurring tasks (in order)
            </Text>
            {orderedTaskSyncIds.map((syncId, index) => {
              const recurringTask = taskBySyncId.get(syncId);
              if (!recurringTask) return null;
              return (
                <Card key={syncId} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Text style={{ width: 18, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {index + 1}
                  </Text>
                  <IconBadge name="checkbox-outline" color={theme.colors.moduleTasks} size="sm" />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }} numberOfLines={1}>
                    {recurringTask.title}
                  </Text>
                  <View style={{ alignItems: 'center' }}>
                    <Pressable accessibilityLabel={`Move ${recurringTask.title} up`} onPress={() => moveTaskEntry(index, 'up')} disabled={index === 0} hitSlop={6}>
                      <Ionicons name="chevron-up" size={16} color={index === 0 ? theme.colors.border : theme.colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Move ${recurringTask.title} down`}
                      onPress={() => moveTaskEntry(index, 'down')}
                      disabled={index === orderedTaskSyncIds.length - 1}
                      hitSlop={6}>
                      <Ionicons name="chevron-down" size={16} color={index === orderedTaskSyncIds.length - 1 ? theme.colors.border : theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                  <Pressable accessibilityLabel={`Remove ${recurringTask.title} from routine`} onPress={() => toggleTask(syncId)} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={20} color={theme.colors.textTertiary} />
                  </Pressable>
                </Card>
              );
            })}
          </View>
        ) : null}

        {habits.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Add habits
            </Text>
            {habits
              .filter(({ habit }) => !orderedHabitSyncIds.includes(habit.sync_id ?? ''))
              .map(({ habit }) => (
                <Pressable key={habit.id} onPress={() => toggleHabit(habit.sync_id)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name={habit.icon as never} color={theme.colors.moduleHabits} size="sm" />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }} numberOfLines={1}>
                      {habit.name}
                    </Text>
                    <Ionicons name="add-circle-outline" size={20} color={theme.colors.moduleHabits} />
                  </Card>
                </Pressable>
              ))}
          </View>
        ) : null}

        {recurringTasks.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Add recurring tasks
            </Text>
            {recurringTasks
              .filter(({ task }) => !orderedTaskSyncIds.includes(task.sync_id ?? ''))
              .map(({ task }) => (
                <Pressable key={task.id} onPress={() => toggleTask(task.sync_id)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name="checkbox-outline" color={theme.colors.moduleTasks} size="sm" />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Ionicons name="add-circle-outline" size={20} color={theme.colors.moduleTasks} />
                  </Card>
                </Pressable>
              ))}
          </View>
        ) : null}

        <Button label="Create routine" onPress={onSave} disabled={!canSave} loading={saving} />
        {!canSave ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
            {!name.trim() ? 'Name the routine to continue' : 'Pick at least 2 habits/tasks to group together'}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
