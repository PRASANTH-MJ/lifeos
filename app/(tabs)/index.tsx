import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Card, Chip, ScreenContainer } from '@/components';
import { addDays, buildMonthGrid, monthCursorOf, shiftMonth, todayKey, weekdayOf } from '@/lib/date';
import {
  HabitLogSheet,
  isDue,
  parseTargetDays,
  useHabits,
  type Habit,
  type HabitLog,
} from '@/modules/habits';
import { CalendarMonthGrid } from '@/modules/calendar';
import {
  TaskLogSheet,
  clearOneTimeTaskLog,
  logOneTimeTaskStatus,
  parseRecurrenceDays,
  useRecurringTasks,
  useTasks,
  type Task,
  type TaskCompletion,
} from '@/modules/tasks';
import { useAppTheme } from '@/theme';

function weekStartOf(dateKey: string): string {
  return addDays(dateKey, -weekdayOf(dateKey));
}

type FilterKey = 'all' | 'important' | 'habits' | 'tasks' | 'recurring';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  important: 'Important',
  habits: 'Habits',
  tasks: 'Task',
  recurring: 'Recurring Task',
};

export default function TodayScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [filter, setFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [habitsDue, setHabitsDue] = useState<{ habit: Habit; log?: HabitLog }[]>([]);
  const [tasksDue, setTasksDue] = useState<{ task: Task; completion?: TaskCompletion; isRecurring: boolean }[]>([]);
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [allRecurringTasks, setAllRecurringTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [habitSheetId, setHabitSheetId] = useState<number | null>(null);
  const [taskSheetId, setTaskSheetId] = useState<number | null>(null);
  const [monthVisible, setMonthVisible] = useState(false);
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => monthCursorOf(selectedDate));
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());

  const { upsertLog, clearLog } = useHabits();
  const { toggleComplete } = useTasks();
  const { upsertCompletion, clearCompletion } = useRecurringTasks();

  const refresh = useCallback(async () => {
    setLoading(true);
    const [habitRows, singleTaskRows, recurringTaskRows] = await Promise.all([
      db.getAllAsync<Habit>('SELECT * FROM habits WHERE archived = 0'),
      db.getAllAsync<Task>(
        'SELECT * FROM tasks WHERE archived = 0 AND parent_task_id IS NULL AND is_recurring = 0 AND completed_at IS NULL AND due_date IS NOT NULL AND due_date <= ?',
        [selectedDate]
      ),
      db.getAllAsync<Task>('SELECT * FROM tasks WHERE archived = 0 AND is_recurring = 1'),
    ]);

    setAllHabits(habitRows);
    setAllRecurringTasks(recurringTaskRows);

    const dueHabits = habitRows.filter((habit) => isDue(selectedDate, habit.frequency, parseTargetDays(habit.target_days)));
    const dueRecurringTasks = recurringTaskRows.filter((task) =>
      isDue(selectedDate, task.recurrence_frequency ?? 'daily', parseRecurrenceDays(task.recurrence_days))
    );

    const habitIds = dueHabits.map((habit) => habit.id);
    const habitLogRows = habitIds.length
      ? await db.getAllAsync<HabitLog>(
          `SELECT * FROM habit_logs WHERE date = ? AND habit_id IN (${habitIds.map(() => '?').join(', ')})`,
          [selectedDate, ...habitIds]
        )
      : [];
    const logByHabit = new Map(habitLogRows.map((log) => [log.habit_id, log]));

    const taskIds = [...singleTaskRows.map((task) => task.id), ...dueRecurringTasks.map((task) => task.id)];
    const completionRows = taskIds.length
      ? await db.getAllAsync<TaskCompletion>(
          `SELECT * FROM task_completions WHERE date = ? AND task_id IN (${taskIds.map(() => '?').join(', ')})`,
          [selectedDate, ...taskIds]
        )
      : [];
    const completionByTask = new Map(completionRows.map((completion) => [completion.task_id, completion]));

    setHabitsDue(dueHabits.map((habit) => ({ habit, log: logByHabit.get(habit.id) })));
    setTasksDue([
      ...singleTaskRows.map((task) => ({ task, completion: completionByTask.get(task.id), isRecurring: false })),
      ...dueRecurringTasks.map((task) => ({ task, completion: completionByTask.get(task.id), isRecurring: true })),
    ]);
    setLoading(false);
  }, [db, selectedDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logOneTimeStatus = useCallback(
    (task: Task, status: TaskCompletion['status'], date: string) => logOneTimeTaskStatus(db, task, status, date, toggleComplete),
    [db, toggleComplete]
  );
  const clearOneTimeLog = useCallback((task: Task, date: string) => clearOneTimeTaskLog(db, task, date, toggleComplete), [db, toggleComplete]);

  useEffect(() => {
    if (!monthVisible) return;
    let cancelled = false;
    (async () => {
      const monthPrefix = `${monthCursor.year}-${String(monthCursor.month + 1).padStart(2, '0')}`;
      const daysInMonth = new Date(monthCursor.year, monthCursor.month + 1, 0).getDate();
      const monthStart = `${monthPrefix}-01`;
      const monthEnd = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;
      const oneTimeRows = await db.getAllAsync<{ due_date: string }>(
        'SELECT due_date FROM tasks WHERE archived = 0 AND is_recurring = 0 AND due_date IS NOT NULL AND due_date BETWEEN ? AND ?',
        [monthStart, monthEnd]
      );
      if (cancelled) return;
      const marks = new Set<string>(oneTimeRows.map((row) => row.due_date));
      for (const dateKey of buildMonthGrid(monthCursor.year, monthCursor.month)) {
        if (dateKey < monthStart || dateKey > monthEnd) continue;
        const hasHabit = allHabits.some((habit) => isDue(dateKey, habit.frequency, parseTargetDays(habit.target_days)));
        const hasRecurringTask =
          !hasHabit &&
          allRecurringTasks.some((task) => isDue(dateKey, task.recurrence_frequency ?? 'daily', parseRecurrenceDays(task.recurrence_days)));
        if (hasHabit || hasRecurringTask) marks.add(dateKey);
      }
      setMarkedDates(marks);
    })();
    return () => {
      cancelled = true;
    };
  }, [monthVisible, monthCursor, allHabits, allRecurringTasks, db]);

  const habitSheetEntry = habitsDue.find((entry) => entry.habit.id === habitSheetId);
  const taskSheetEntry = tasksDue.find((entry) => entry.task.id === taskSheetId);

  const query = searchQuery.trim().toLowerCase();
  const matchesQuery = (label: string) => !query || label.toLowerCase().includes(query);

  const filteredHabits = (filter === 'tasks' || filter === 'important' || filter === 'recurring' ? [] : habitsDue).filter(
    ({ habit }) => matchesQuery(habit.name)
  );
  const filteredTasks = (
    filter === 'habits'
      ? []
      : filter === 'important'
        ? tasksDue.filter((t) => t.task.important)
        : filter === 'tasks'
          ? tasksDue.filter((t) => !t.isRecurring)
          : filter === 'recurring'
            ? tasksDue.filter((t) => t.isRecurring)
            : tasksDue
  ).filter(({ task }) => matchesQuery(task.title));

  const weekStart = weekStartOf(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const openMonth = () => {
    setMonthCursor(monthCursorOf(selectedDate));
    setMonthVisible(true);
  };

  return (
    <View style={{ flex: 1 }}>
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Today
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {weekDays.map((dateKey) => {
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === todayKey();
            const [, , day] = dateKey.split('-');
            return (
              <Pressable key={dateKey} onPress={() => setSelectedDate(dateKey)} style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'][weekdayOf(dateKey)]}
                </Text>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: theme.radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? theme.colors.primary : isToday ? theme.colors.primaryMuted : 'transparent',
                  }}>
                  <Text style={{ color: isSelected ? '#fff' : theme.colors.textPrimary, fontWeight: theme.typography.weight.semibold }}>
                    {Number(day)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.full,
              borderWidth: 1,
              borderColor: theme.colors.border,
              paddingHorizontal: theme.spacing.md,
            }}>
            <Ionicons name="search" size={16} color={theme.colors.textTertiary} />
            <TextInput
              placeholder="Search habits & tasks"
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                marginLeft: theme.spacing.sm,
                color: theme.colors.textPrimary,
                fontSize: theme.typography.size.sm,
                paddingVertical: theme.spacing.sm,
              }}
            />
          </View>
          <Pressable
            onPress={openMonth}
            accessibilityLabel="Open month calendar"
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
            <Ionicons name="calendar" size={18} color={theme.colors.textPrimary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {(['all', 'important', 'habits', 'tasks', 'recurring'] as FilterKey[]).map((key) => (
            <Chip key={key} label={FILTER_LABELS[key]} selected={filter === key} onPress={() => setFilter(key)} />
          ))}
        </View>

        {!loading && filteredHabits.length === 0 && filteredTasks.length === 0 ? (
          <Card>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Nothing scheduled for this day.</Text>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {filteredHabits.map(({ habit, log }) => (
              <Pressable key={`habit-${habit.id}`} onPress={() => setHabitSheetId(habit.id)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Ionicons name={habit.icon as never} size={18} color={theme.colors.moduleHabits} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>{habit.name}</Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Habit</Text>
                  </View>
                  <StatusDot status={log?.status} color={theme.colors.moduleHabits} />
                </Card>
              </Pressable>
            ))}
            {filteredTasks.map(({ task, completion, isRecurring }) => (
              <Pressable key={`task-${task.id}`} onPress={() => setTaskSheetId(task.id)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  {task.important ? <Ionicons name="star" size={16} color={theme.colors.warning} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: theme.colors.textPrimary,
                        fontSize: theme.typography.size.base,
                        textDecorationLine: task.completed_at ? 'line-through' : 'none',
                      }}>
                      {task.title}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      {isRecurring ? 'Recurring task' : 'Task'}
                    </Text>
                  </View>
                  <StatusDot status={completion?.status ?? (task.completed_at ? 'done' : undefined)} color={theme.colors.moduleTasks} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable onPress={() => router.push('/journal/new')}>
          <Card
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              backgroundColor: theme.colors.moduleJournalMuted,
              borderColor: theme.colors.moduleJournalMuted,
            }}>
            <Ionicons name="book" size={22} color={theme.colors.moduleJournal} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
              Write in your journal
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push('/analytics')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Ionicons name="stats-chart" size={22} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
              View your insights
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Card>
        </Pressable>
      </View>

      {habitSheetEntry ? (
        <HabitLogSheet
          visible
          habit={habitSheetEntry.habit}
          date={selectedDate}
          existingLog={habitSheetEntry.log}
          onClose={() => setHabitSheetId(null)}
          onSave={async (values) => {
            await upsertLog(habitSheetEntry.habit.id, values);
            await refresh();
          }}
          onClear={async () => {
            await clearLog(habitSheetEntry.habit.id, selectedDate);
            await refresh();
          }}
        />
      ) : null}

      {taskSheetEntry ? (
        <TaskLogSheet
          visible
          task={taskSheetEntry.task}
          date={selectedDate}
          existingLog={taskSheetEntry.completion}
          onClose={() => setTaskSheetId(null)}
          onSave={async (status) => {
            if (taskSheetEntry.isRecurring) {
              await upsertCompletion(taskSheetEntry.task.id, { status, date: selectedDate });
            } else {
              await logOneTimeStatus(taskSheetEntry.task, status, selectedDate);
            }
            await refresh();
          }}
          onClear={async () => {
            if (taskSheetEntry.isRecurring) {
              await clearCompletion(taskSheetEntry.task.id, selectedDate);
            } else {
              await clearOneTimeLog(taskSheetEntry.task, selectedDate);
            }
            await refresh();
          }}
        />
      ) : null}

      <Modal visible={monthVisible} animationType="slide" transparent onRequestClose={() => setMonthVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setMonthVisible(false)} />
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.lg,
            }}>
            <CalendarMonthGrid
              year={monthCursor.year}
              month={monthCursor.month}
              selectedDate={selectedDate}
              markedDates={markedDates}
              onSelectDate={(dateKey) => {
                setSelectedDate(dateKey);
                setMonthVisible(false);
              }}
              onChangeMonth={(delta) => setMonthCursor((cursor) => shiftMonth(cursor, delta))}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>

    <Pressable
      onPress={() => setCreateMenuVisible(true)}
      accessibilityLabel="Create new"
      style={{
        position: 'absolute',
        right: theme.spacing.xl,
        bottom: theme.spacing.xl,
        width: 56,
        height: 56,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}>
      <Ionicons name="add" size={28} color="#fff" />
    </Pressable>

    <Modal visible={createMenuVisible} animationType="slide" transparent onRequestClose={() => setCreateMenuVisible(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setCreateMenuVisible(false)} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.sm,
          }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold, marginBottom: theme.spacing.sm }}>
            Create new
          </Text>
          {(
            [
              { label: 'Habit', icon: 'checkmark-circle-outline', color: theme.colors.moduleHabits, onPress: () => router.push('/habits/new') },
              { label: 'Task', icon: 'checkbox-outline', color: theme.colors.moduleTasks, onPress: () => router.push('/tasks/new') },
              {
                label: 'Recurring Task',
                icon: 'repeat-outline',
                color: theme.colors.moduleTasks,
                onPress: () => router.push({ pathname: '/tasks/new', params: { recurring: '1' } }),
              },
              { label: 'Journal Entry', icon: 'book-outline', color: theme.colors.moduleJournal, onPress: () => router.push('/journal/new') },
              { label: 'Expense', icon: 'cash-outline', color: theme.colors.primary, onPress: () => router.push('/finance/new') },
              { label: 'Food Log', icon: 'restaurant-outline', color: theme.colors.moduleTasks, onPress: () => router.push('/food/new') },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                setCreateMenuVisible(false);
                item.onPress();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
    </View>
  );
}

function StatusDot({ status, color }: { status?: 'done' | 'fail' | 'skip'; color: string }) {
  const theme = useAppTheme();
  const iconName = status === 'done' ? 'checkmark-circle' : status === 'fail' ? 'close-circle' : status === 'skip' ? 'remove-circle' : 'ellipse-outline';
  const iconColor = status === 'done' ? theme.colors.success : status === 'fail' ? theme.colors.danger : status === 'skip' ? theme.colors.textTertiary : color;
  return <Ionicons name={iconName} size={20} color={iconColor} />;
}
