import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EmptyState, ScreenContainer, useTabSwipeNavigation } from '@/components';
import { todayKey } from '@/lib/date';
import { useCategories } from '@/modules/categories';
import { RecurringTaskListItem, TaskListItem, TaskLogSheet, useRecurringTasks, useTasks } from '@/modules/tasks';
import { useAppTheme } from '@/theme';

export default function TasksScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const swipeHandlers = useTabSwipeNavigation('/tasks');
  const { tasks, loading, subtaskCounts, toggleComplete, refresh } = useTasks();
  const {
    tasks: recurringTasks,
    loading: loadingRecurring,
    upsertCompletion,
    clearCompletion,
    refresh: refreshRecurring,
  } = useRecurringTasks();
  const { categories } = useCategories('task');
  const [tab, setTab] = useState<'single' | 'recurring'>('single');
  const [sheetTaskId, setSheetTaskId] = useState<number | null>(null);

  const sheetEntry = recurringTasks.find((entry) => entry.task.id === sheetTaskId);
  const refreshAll = async () => {
    await Promise.all([refresh(), refreshRecurring()]);
  };

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
            <Pressable key={option} onPress={() => setTab(option)} style={{ paddingBottom: theme.spacing.sm, borderBottomWidth: 2, borderBottomColor: tab === option ? theme.colors.moduleTasks : 'transparent' }}>
              <Text style={{ color: tab === option ? theme.colors.moduleTasks : theme.colors.textTertiary, fontWeight: theme.typography.weight.semibold }}>
                {option === 'single' ? 'Single tasks' : 'Recurring tasks'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'single' ? (
          !loading && tasks.length === 0 ? (
            <EmptyState
              icon="checkbox-outline"
              title="No tasks yet"
              subtitle="Add a to-do with a priority and due date to get started."
              ctaLabel="Add your first task"
              onPressCta={() => router.push('/tasks/new')}
            />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {tasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  subtaskCount={subtaskCounts[task.id]}
                  category={categories.find((c) => c.id === task.category_id)}
                  onToggle={() => toggleComplete(task)}
                />
              ))}
            </View>
          )
        ) : !loadingRecurring && recurringTasks.length === 0 ? (
          <EmptyState
            icon="repeat-outline"
            title="No recurring tasks yet"
            subtitle="Add a task that repeats every day, week, or month."
            ctaLabel="Add a recurring task"
            onPressCta={() => router.push({ pathname: '/tasks/new', params: { recurring: '1' } })}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {recurringTasks.map(({ task, todayLog, due, periodProgress }) => (
              <RecurringTaskListItem
                key={task.id}
                task={task}
                todayLog={todayLog}
                due={due}
                periodProgress={periodProgress}
                category={categories.find((c) => c.id === task.category_id)}
                onOpenLogSheet={() => setSheetTaskId(task.id)}
              />
            ))}
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
