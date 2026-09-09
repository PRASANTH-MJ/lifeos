import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLiveQuery } from 'dexie-react-hooks';

import { Card, Chip, FAB_BOTTOM_OFFSET, IconBadge, ProgressBar, ScreenContainer, UpsellModal, useTabSwipeNavigation } from '@/components';
import { webDb } from '@/db/webDb';
import { addDays, buildMonthGrid, monthCursorOf, shiftMonth, todayKey, weekdayOf } from '@/lib/date';
import { useCategories } from '@/modules/categories';
import { LIMIT_LABELS, useFreeTierGate, type LimitKind } from '@/modules/premium';
import {
  HabitLogSheet,
  isDue,
  parseTargetDays,
  useHabits,
  type Habit,
  type HabitLog,
} from '@/modules/habits';
import { CalendarMonthGrid } from '@/modules/calendar';
import { ClubHabitsSection, ClubTasksSection } from '@/modules/clubs';
import { CheckinSheet, useCheckins } from '@/modules/journal';
import {
  TaskLogSheet,
  parseRecurrenceDays,
  useRecurringTasks,
  useTasks,
  type Task,
  type TaskCompletion,
} from '@/modules/tasks';
// Explicit .web import — the barrel's extensionless re-export resolves to the native (5-arg)
// logOneTimeTask.ts for cross-file type-checking (tsc doesn't apply Metro's platform-extension
// resolution), even though Metro correctly bundles the 4-arg web version here at runtime.
import { clearOneTimeTaskLog, logOneTimeTaskStatus } from '@/modules/tasks/logOneTimeTask.web';
import { useAppTheme } from '@/theme';

function weekStartOf(dateKey: string): string {
  return addDays(dateKey, -weekdayOf(dateKey));
}

type FilterKey = 'all' | 'important' | 'habits' | 'tasks' | 'recurring' | 'overdue' | 'thisWeek' | 'thisMonth';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  important: 'Important',
  habits: 'Habits',
  tasks: 'Task',
  recurring: 'Recurring Task',
  overdue: 'Overdue',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
};

// "Overdue"/"This Week"/"This Month" filter by a task's stored `due_date`, which only
// one-time tasks have — habits and recurring tasks are "due" purely via `isDue(date, frequency,
// targetDays)` recomputed per day, with no fixed date to compare against "today". So these three
// filters hide habits/recurring tasks entirely (same precedent as the existing "Important" filter
// already hiding habits) rather than inventing a fuzzy notion of an overdue habit.
//
// They also can't reuse the screen's normal single-selected-day data: the day-scoped query only
// loads what's due on `selectedDate`. A "This Week" or "This Month" view needs one-time tasks
// whose due_date falls anywhere in that range, so selecting one of these filters switches the
// task list to a separate range query (see rangeTasksDue below) instead of the day-scoped
// `tasksDue`. The date strip at top keeps working (it still drives the day-scoped filters), it
// just stops being the source of the visible list until the user switches back to
// All/Important/Habits/Task/Recurring.
function isDateRangeFilter(filter: FilterKey): boolean {
  return filter === 'overdue' || filter === 'thisWeek' || filter === 'thisMonth';
}

type HabitsDueEntry = { habit: Habit; log?: HabitLog };
type TasksDueEntry = { task: Task; completion?: TaskCompletion; isRecurring: boolean };

export default function TodayScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const swipeHandlers = useTabSwipeNavigation('/');

  const [selectedDate, setSelectedDate] = useState(todayKey());
  // The date the app last believed was "today" — compared against a fresh todayKey() whenever
  // the app resumes from background, so a habit/task checked off before midnight and reopened
  // after doesn't keep showing yesterday's completed state forever (this screen stays mounted
  // across tab switches and app backgrounding, so nothing else would ever notice the day rolled
  // over). Only auto-advances selectedDate when it was tracking today specifically — someone
  // deliberately browsing a past day shouldn't get yanked back to today under them.
  const todayRef = useRef(todayKey());
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { categories } = useCategories();
  const [habitSheetId, setHabitSheetId] = useState<number | null>(null);
  const [taskSheetId, setTaskSheetId] = useState<number | null>(null);
  const [monthVisible, setMonthVisible] = useState(false);
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const habitGate = useFreeTierGate('habits');
  const recurringGate = useFreeTierGate('recurringTasks');
  const taskGate = useFreeTierGate('tasks');
  const journalGate = useFreeTierGate('journalEntries');
  const [upsellKind, setUpsellKind] = useState<LimitKind | null>(null);
  const { morning, night, saveMorning, saveNight } = useCheckins();
  const [checkinSheet, setCheckinSheet] = useState<'morning' | 'night' | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => monthCursorOf(selectedDate));

  const { upsertLog, clearLog } = useHabits();
  const { toggleComplete } = useTasks();
  const { upsertCompletion, clearCompletion } = useRecurringTasks();

  // Day-scoped data: habits/tasks due on selectedDate plus that day's logs/completions. Reactive
  // via useLiveQuery — a write from this tab, another tab, or the sync engine's merge re-runs
  // this automatically, which is what supersedes the native version's refresh()/useFocusEffect
  // combo (see isDue/parseTargetDays/parseRecurrenceDays for the "due today" recomputation, kept
  // unchanged since they're pure helpers with nothing SQL-specific about them).
  const dayData = useLiveQuery(async () => {
    const [habitRows, taskRows] = await Promise.all([
      webDb.habits.toArray() as unknown as Promise<Habit[]>,
      webDb.tasks.toArray() as unknown as Promise<Task[]>,
    ]);

    const activeHabits = habitRows.filter((habit) => !habit.archived);
    const activeTasks = taskRows.filter((task) => !task.archived);

    const singleTaskRows = activeTasks.filter(
      (task) => task.parent_task_id == null && !task.is_recurring && task.due_date != null && task.due_date <= selectedDate
    );
    const recurringTaskRows = activeTasks.filter((task) => task.is_recurring);

    const dueHabits = activeHabits.filter((habit) => isDue(selectedDate, habit.frequency, parseTargetDays(habit.target_days)));
    const dueRecurringTasks = recurringTaskRows.filter((task) =>
      isDue(selectedDate, task.recurrence_frequency ?? 'daily', parseRecurrenceDays(task.recurrence_days))
    );

    const habitIds = new Set(dueHabits.map((habit) => habit.id));
    const habitLogRows = habitIds.size
      ? ((await webDb.habit_logs.toArray()) as HabitLog[]).filter((log) => log.date === selectedDate && habitIds.has(log.habit_id))
      : [];
    const logByHabit = new Map(habitLogRows.map((log) => [log.habit_id, log]));

    const taskIds = new Set([...singleTaskRows.map((task) => task.id), ...dueRecurringTasks.map((task) => task.id)]);
    const completionRows = taskIds.size
      ? ((await webDb.task_completions.toArray()) as TaskCompletion[]).filter((c) => c.date === selectedDate && taskIds.has(c.task_id))
      : [];
    const completionByTask = new Map(completionRows.map((completion) => [completion.task_id, completion]));

    const habitsDue: HabitsDueEntry[] = dueHabits.map((habit) => ({ habit, log: logByHabit.get(habit.id) }));
    const tasksDue: TasksDueEntry[] = [
      ...singleTaskRows.map((task) => ({ task, completion: completionByTask.get(task.id), isRecurring: false })),
      ...dueRecurringTasks.map((task) => ({ task, completion: completionByTask.get(task.id), isRecurring: true })),
    ];

    return { allHabits: activeHabits, allRecurringTasks: recurringTaskRows, habitsDue, tasksDue };
  }, [selectedDate]);

  const allHabits = dayData?.allHabits ?? [];
  const allRecurringTasks = dayData?.allRecurringTasks ?? [];
  const habitsDue = dayData?.habitsDue ?? [];
  const tasksDue = dayData?.tasksDue ?? [];

  // Range query backing the "Overdue"/"This Week"/"This Month" filters — see isDateRangeFilter's
  // comment for why these need a separate, non-day-scoped read of one-time tasks by due_date.
  const rangeData = useLiveQuery(async () => {
    if (!isDateRangeFilter(filter)) return [];
    const today = todayKey();
    const taskRows = (await webDb.tasks.toArray()) as Task[];
    const activeSingleTasks = taskRows.filter(
      (task) => !task.archived && task.parent_task_id == null && !task.is_recurring && task.due_date != null
    );

    let rows: Task[];
    if (filter === 'overdue') {
      rows = activeSingleTasks.filter((task) => (task.due_date as string) < today && task.completed_at == null);
    } else {
      let startDate: string;
      let endDate: string;
      if (filter === 'thisWeek') {
        startDate = weekStartOf(today);
        endDate = addDays(startDate, 6);
      } else {
        const [year, month] = today.split('-');
        const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
        startDate = `${year}-${month}-01`;
        endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`;
      }
      rows = activeSingleTasks.filter((task) => (task.due_date as string) >= startDate && (task.due_date as string) <= endDate);
    }

    return rows.map((task) => ({ task, completion: undefined, isRecurring: false })) as TasksDueEntry[];
  }, [filter]);

  const rangeTasksDue = rangeData ?? [];
  const loading = dayData === undefined || (isDateRangeFilter(filter) && rangeData === undefined);

  const refreshIfNewDay = useCallback(() => {
    const newToday = todayKey();
    if (newToday !== todayRef.current) {
      setSelectedDate((current) => (current === todayRef.current ? newToday : current));
      todayRef.current = newToday;
    }
  }, []);

  // Covers the app being backgrounded overnight and resumed the next morning — foregrounding
  // alone doesn't remount this screen or fire any other effect, so without this, a habit/task
  // marked done "yesterday evening" would still read as done indefinitely.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfNewDay();
    });
    return () => subscription.remove();
  }, [refreshIfNewDay]);

  // Also re-check the day every time this tab regains focus. Data itself no longer needs a manual
  // re-fetch on focus (useLiveQuery above already keeps it live across tabs/screens), but the
  // "did the calendar day roll over" check still needs to happen here since nothing else notices.
  useFocusEffect(
    useCallback(() => {
      refreshIfNewDay();
    }, [refreshIfNewDay])
  );

  // The tab navigator keeps this screen mounted when you switch tabs, but RN's Modal renders as
  // a top-level native overlay regardless of which tab is focused — so a sheet left open here
  // would otherwise keep floating over Habits/Journal/etc. after navigating away. Close
  // everything on blur so leaving the tab always leaves it in a clean state.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setHabitSheetId(null);
        setTaskSheetId(null);
        setMonthVisible(false);
        setCreateMenuVisible(false);
        setUpsellKind(null);
        setCheckinSheet(null);
      };
    }, [])
  );

  const logOneTimeStatus = useCallback(
    (task: Task, status: TaskCompletion['status'], date: string) => logOneTimeTaskStatus(task, status, date, toggleComplete),
    [toggleComplete]
  );
  const clearOneTimeLog = useCallback((task: Task, date: string) => clearOneTimeTaskLog(task, date, toggleComplete), [toggleComplete]);

  const markedDates = useLiveQuery(async () => {
    if (!monthVisible) return new Set<string>();
    const monthPrefix = `${monthCursor.year}-${String(monthCursor.month + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(monthCursor.year, monthCursor.month + 1, 0).getDate();
    const monthStart = `${monthPrefix}-01`;
    const monthEnd = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;

    const taskRows = (await webDb.tasks.toArray()) as Task[];
    const oneTimeRows = taskRows.filter(
      (task) => !task.archived && !task.is_recurring && task.due_date != null && task.due_date >= monthStart && task.due_date <= monthEnd
    );
    const marks = new Set<string>(oneTimeRows.map((row) => row.due_date as string));
    for (const dateKey of buildMonthGrid(monthCursor.year, monthCursor.month)) {
      if (dateKey < monthStart || dateKey > monthEnd) continue;
      const hasHabit = allHabits.some((habit) => isDue(dateKey, habit.frequency, parseTargetDays(habit.target_days)));
      const hasRecurringTask =
        !hasHabit &&
        allRecurringTasks.some((task) => isDue(dateKey, task.recurrence_frequency ?? 'daily', parseRecurrenceDays(task.recurrence_days)));
      if (hasHabit || hasRecurringTask) marks.add(dateKey);
    }
    return marks;
  }, [monthVisible, monthCursor, allHabits, allRecurringTasks]) ?? new Set<string>();

  const habitSheetEntry = habitsDue.find((entry) => entry.habit.id === habitSheetId);
  // Tapping a card opened from a range-filter result (a task not necessarily due on
  // selectedDate) needs its entry looked up from rangeTasksDue too, not just the day-scoped list.
  const taskSheetEntry =
    tasksDue.find((entry) => entry.task.id === taskSheetId) ?? rangeTasksDue.find((entry) => entry.task.id === taskSheetId);

  const query = searchQuery.trim().toLowerCase();
  const matchesQuery = (label: string) => !query || label.toLowerCase().includes(query);

  const matchesCategory = (categoryId: number | null) => categoryFilter === 'all' || categoryId === categoryFilter;

  const rangeFilterActive = isDateRangeFilter(filter);
  const filteredHabits = (
    filter === 'tasks' || filter === 'important' || filter === 'recurring' || rangeFilterActive ? [] : habitsDue
  ).filter(({ habit }) => matchesQuery(habit.name) && matchesCategory(habit.category_id));
  const filteredTasks = (
    rangeFilterActive
      ? rangeTasksDue
      : filter === 'habits'
        ? []
        : filter === 'important'
          ? tasksDue.filter((t) => t.task.important)
          : filter === 'tasks'
            ? tasksDue.filter((t) => !t.isRecurring)
            : filter === 'recurring'
              ? tasksDue.filter((t) => t.isRecurring)
              : tasksDue
  ).filter(({ task }) => matchesQuery(task.title) && matchesCategory(task.category_id));

  const pendingHabits = filteredHabits.filter(({ log }) => log?.status !== 'done');
  const completedHabits = filteredHabits.filter(({ log }) => log?.status === 'done');
  const isTaskDone = (task: Task, completion?: TaskCompletion) => (completion?.status ?? (task.completed_at ? 'done' : undefined)) === 'done';
  const pendingTasks = filteredTasks.filter(({ task, completion }) => !isTaskDone(task, completion));
  const completedTasks = filteredTasks.filter(({ task, completion }) => isTaskDone(task, completion));
  const completedCount = completedHabits.length + completedTasks.length;

  // Compact dashboard tiles reflect the whole day's due habits/tasks (habitsDue/tasksDue),
  // independent of the active list filter above (completedCount/completedHabits/completedTasks
  // are filter-aware, used for the "Show completed" section further down).
  const doneHabitsToday = habitsDue.filter(({ log }) => log?.status === 'done').length;
  const doneTasksToday = tasksDue.filter(({ task, completion }) => isTaskDone(task, completion)).length;

  const usedCategoryIds = new Set(
    [...habitsDue.map((h) => h.habit.category_id), ...tasksDue.map((t) => t.task.category_id)].filter((id): id is number => id != null)
  );
  const usedCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  const weekStart = weekStartOf(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const openMonth = () => {
    setMonthCursor(monthCursorOf(selectedDate));
    setMonthVisible(true);
  };

  const refreshCurrent = useCallback(async () => {
    // No-op: useLiveQuery above already keeps everything live across tabs/writes. Kept so
    // ScreenContainer's pull-to-refresh still has something to await.
  }, []);

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
    <ScreenContainer onRefresh={refreshCurrent}>
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Today
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, marginTop: 2 }}>
            {habitsDue.length + tasksDue.length === 0 ? 'Nothing scheduled' : `${completedCount} of ${habitsDue.length + tasksDue.length} complete`}
          </Text>
        </View>

        {habitsDue.length + tasksDue.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <CompactStatTile
              icon="checkmark-done-outline"
              label="Habits"
              value={`${doneHabitsToday}/${habitsDue.length}`}
              progress={habitsDue.length > 0 ? doneHabitsToday / habitsDue.length : 0}
              color={theme.colors.moduleHabits}
            />
            <CompactStatTile
              icon="checkbox-outline"
              label="Tasks"
              value={`${doneTasksToday}/${tasksDue.length}`}
              progress={tasksDue.length > 0 ? doneTasksToday / tasksDue.length : 0}
              color={theme.colors.moduleTasks}
            />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Pressable onPress={() => setSelectedDate((d) => addDays(d, -7))} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
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
          <Pressable onPress={() => setSelectedDate((d) => addDays(d, 7))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </Pressable>
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
          {(['all', 'important', 'habits', 'tasks', 'recurring', 'overdue', 'thisWeek', 'thisMonth'] as FilterKey[]).map((key) => (
            <Chip key={key} label={FILTER_LABELS[key]} selected={filter === key} onPress={() => setFilter(key)} />
          ))}
        </View>

        {usedCategories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
            <Chip label="All lists" selected={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
            {usedCategories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={categoryFilter === category.id}
                color={category.color}
                onPress={() => setCategoryFilter(category.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        {!loading && filteredHabits.length === 0 && filteredTasks.length === 0 ? (
          <Card>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
              {rangeFilterActive ? 'Nothing found for this range.' : 'Nothing scheduled for this day.'}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {pendingHabits.length === 0 && pendingTasks.length === 0 ? (
              <Card>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                  {rangeFilterActive ? 'All caught up! 🎉' : 'All done for today! 🎉'}
                </Text>
              </Card>
            ) : (
              <>
                {pendingHabits.map(({ habit, log }) => (
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
                {pendingTasks.map(({ task, completion, isRecurring }) => (
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
              </>
            )}

            {completedCount > 0 ? (
              <>
                <Pressable
                  onPress={() => setShowCompleted((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, flex: 1 }}>
                    {showCompleted ? 'Hide' : 'Show'} completed ({completedCount})
                  </Text>
                  <Ionicons name={showCompleted ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textTertiary} />
                </Pressable>

                {showCompleted ? (
                  <>
                    {completedHabits.map(({ habit, log }) => (
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
                    {completedTasks.map(({ task, completion, isRecurring }) => (
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
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        )}

        <Pressable onPress={() => router.push('/journal-new')}>
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

        <ClubHabitsSection />
        <ClubTasksSection />
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
          }}
          onClear={async () => {
            await clearLog(habitSheetEntry.habit.id, selectedDate);
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
          }}
          onClear={async () => {
            if (taskSheetEntry.isRecurring) {
              await clearCompletion(taskSheetEntry.task.id, selectedDate);
            } else {
              await clearOneTimeLog(taskSheetEntry.task, selectedDate);
            }
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
        bottom: FAB_BOTTOM_OFFSET,
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
              {
                label: 'Habit',
                icon: 'checkmark-circle-outline',
                color: theme.colors.moduleHabits,
                onPress: () => (habitGate.allowed ? router.push('/habits-new') : setUpsellKind('habits')),
              },
              {
                label: 'Task',
                icon: 'checkbox-outline',
                color: theme.colors.moduleTasks,
                onPress: () => (taskGate.allowed ? router.push('/tasks-new') : setUpsellKind('tasks')),
              },
              {
                label: 'Recurring Task',
                icon: 'repeat-outline',
                color: theme.colors.moduleTasks,
                onPress: () =>
                  recurringGate.allowed
                    ? router.push({ pathname: '/tasks-new', params: { recurring: '1' } })
                    : setUpsellKind('recurringTasks'),
              },
              {
                label: 'Journal Entry',
                icon: 'book-outline',
                color: theme.colors.moduleJournal,
                onPress: () => (journalGate.allowed ? router.push('/journal-new') : setUpsellKind('journalEntries')),
              },
              { label: 'Morning check-in', icon: 'sunny-outline', color: theme.colors.moduleJournal, onPress: () => setCheckinSheet('morning') },
              { label: 'Night check-in', icon: 'moon-outline', color: theme.colors.moduleJournal, onPress: () => setCheckinSheet('night') },
              { label: 'Expense', icon: 'cash-outline', color: theme.colors.primary, onPress: () => router.push('/finance-new') },
              { label: 'Food Log', icon: 'restaurant-outline', color: theme.colors.moduleTasks, onPress: () => router.push('/food-new') },
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

    <UpsellModal
      visible={upsellKind != null}
      resourceLabel={upsellKind ? LIMIT_LABELS[upsellKind] : ''}
      limit={
        upsellKind === 'habits'
          ? habitGate.limit
          : upsellKind === 'recurringTasks'
            ? recurringGate.limit
            : upsellKind === 'journalEntries'
              ? journalGate.limit
              : taskGate.limit
      }
      onClose={() => setUpsellKind(null)}
    />

    <CheckinSheet
      visible={checkinSheet != null}
      type={checkinSheet ?? 'morning'}
      existing={checkinSheet === 'night' ? night : morning}
      onClose={() => setCheckinSheet(null)}
      onSaveMorning={saveMorning}
      onSaveNight={saveNight}
    />
    </View>
  );
}

/** Compact 2-up dashboard tile — icon+label header, big bold number, thin progress-bar footer.
 * Local to this screen (mirrors the habits tab's identical tile), since the shared StatCard
 * intentionally stays icon/progress-free. */
function CompactStatTile({
  icon,
  label,
  value,
  progress,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  progress: number;
  color: string;
}) {
  const theme = useAppTheme();
  return (
    <Card style={{ flex: 1, gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <IconBadge name={icon} color={color} size="sm" />
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium, flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
        {value}
      </Text>
      <ProgressBar progress={progress} color={color} height={5} />
    </Card>
  );
}

function StatusDot({ status, color }: { status?: 'done' | 'fail' | 'skip'; color: string }) {
  const theme = useAppTheme();
  const iconName = status === 'done' ? 'checkmark-circle' : status === 'fail' ? 'close-circle' : status === 'skip' ? 'remove-circle' : 'ellipse-outline';
  const iconColor = status === 'done' ? theme.colors.success : status === 'fail' ? theme.colors.danger : status === 'skip' ? theme.colors.textTertiary : color;
  return <Ionicons name={iconName} size={20} color={iconColor} />;
}
