import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Chip, EmptyState, ScreenContainer, useTabSwipeNavigation } from '@/components';
import { todayKey } from '@/lib/date';
import { useCategories } from '@/modules/categories';
import { RecurringTaskListItem, TaskListItem, TaskLogSheet, useRecurringTasks, useTasks } from '@/modules/tasks';
import { useAppTheme } from '@/theme';

type FilterKey = 'all' | number;

export default function TasksScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const swipeHandlers = useTabSwipeNavigation('/tasks');
  const { tasks, loading, subtaskCounts, toggleComplete, archiveTask, removeTask, refresh } = useTasks();
  const {
    tasks: recurringTasks,
    loading: loadingRecurring,
    upsertCompletion,
    clearCompletion,
    moveRecurringTask,
    archiveRecurringTask,
    removeRecurringTask,
    refresh: refreshRecurring,
  } = useRecurringTasks();
  const { categories } = useCategories('task');
  const [tab, setTab] = useState<'single' | 'recurring'>('single');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sheetTaskId, setSheetTaskId] = useState<number | null>(null);

  const sheetEntry = recurringTasks.find((entry) => entry.task.id === sheetTaskId);
  const refreshAll = async () => {
    await Promise.all([refresh(), refreshRecurring()]);
  };

  const changeTab = (next: 'single' | 'recurring') => {
    setTab(next);
    setFilter('all');
  };

  const usedCategoryIds = new Set(
    (tab === 'single' ? tasks : recurringTasks.map((r) => r.task)).map((t) => t.category_id).filter((id): id is number => id != null)
  );
  const usedCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  const filteredTasks = filter === 'all' ? tasks : tasks.filter((t) => t.category_id === filter);
  const filteredRecurring = filter === 'all' ? recurringTasks : recurringTasks.filter(({ task }) => task.category_id === filter);

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
    <ScreenContainer onRefresh={refreshAll}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/tasks/new', params: tab === 'recurring' ? { recurring: '1' } : {} })}>
              <Ionicons name="add-circle" size={28} color={theme.colors.moduleTasks} />
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xl, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
          {(['single', 'recurring'] as const).map((option) => (
            <Pressable key={option} onPress={() => changeTab(option)} style={{ paddingBottom: theme.spacing.sm, borderBottomWidth: 2, borderBottomColor: tab === option ? theme.colors.moduleTasks : 'transparent' }}>
              <Text style={{ color: tab === option ? theme.colors.moduleTasks : theme.colors.textTertiary, fontWeight: theme.typography.weight.semibold }}>
                {option === 'single' ? 'Single tasks' : 'Recurring tasks'}
              </Text>
            </Pressable>
          ))}
        </View>

        {usedCategories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
            <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
            {usedCategories.map((category) => (
              <Chip key={category.id} label={category.name} selected={filter === category.id} color={category.color} onPress={() => setFilter(category.id)} />
            ))}
          </ScrollView>
        ) : null}

        {tab === 'single' ? (
          !loading && filteredTasks.length === 0 ? (
            <EmptyState
              icon="checkbox-outline"
              title={tasks.length === 0 ? 'No tasks yet' : 'Nothing in this list'}
              subtitle={tasks.length === 0 ? 'Add a to-do with a priority and due date to get started.' : undefined}
              ctaLabel={tasks.length === 0 ? 'Add your first task' : undefined}
              onPressCta={tasks.length === 0 ? () => router.push('/tasks/new') : undefined}
            />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {filteredTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  subtaskCount={subtaskCounts[task.id]}
                  category={categories.find((c) => c.id === task.category_id)}
                  onToggle={() => toggleComplete(task)}
                  onArchive={() => archiveTask(task.id)}
                  onDelete={() => removeTask(task.id)}
                />
              ))}
            </View>
          )
        ) : !loadingRecurring && filteredRecurring.length === 0 ? (
          <EmptyState
            icon="repeat-outline"
            title={recurringTasks.length === 0 ? 'No recurring tasks yet' : 'Nothing in this list'}
            subtitle={recurringTasks.length === 0 ? 'Add a task that repeats every day, week, or month.' : undefined}
            ctaLabel={recurringTasks.length === 0 ? 'Add a recurring task' : undefined}
            onPressCta={recurringTasks.length === 0 ? () => router.push({ pathname: '/tasks/new', params: { recurring: '1' } }) : undefined}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {filteredRecurring.map(({ task, todayLog, due, periodProgress }) => {
              const fullIndex = recurringTasks.findIndex((r) => r.task.id === task.id);
              return (
                <RecurringTaskListItem
                  key={task.id}
                  task={task}
                  todayLog={todayLog}
                  due={due}
                  periodProgress={periodProgress}
                  category={categories.find((c) => c.id === task.category_id)}
                  onOpenLogSheet={() => setSheetTaskId(task.id)}
                  canMoveUp={filter === 'all' && fullIndex > 0}
                  canMoveDown={filter === 'all' && fullIndex < recurringTasks.length - 1}
                  onMoveUp={filter === 'all' ? () => moveRecurringTask(task.id, 'up') : undefined}
                  onMoveDown={filter === 'all' ? () => moveRecurringTask(task.id, 'down') : undefined}
                  onArchive={() => archiveRecurringTask(task.id)}
                  onDelete={() => removeRecurringTask(task.id)}
                />
              );
            })}
          </View>
        )}
      </View>

      {sheetEntry ? (
        <TaskLogSheet
          visible
          task={sheetEntry.task}
          date={todayKey()}
          existingLog={sheetEntry.todayLog}
          onClose={() => setSheetTaskId(null)}
          onSave={(status) => upsertCompletion(sheetEntry.task.id, { status })}
          onClear={() => clearCompletion(sheetEntry.task.id)}
        />
      ) : null}
    </ScreenContainer>
    </View>
  );
}
