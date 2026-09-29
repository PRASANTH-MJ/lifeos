import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Chip, EmptyState, ImportFormatModal, ScreenContainer, UpsellModal, showAlert, type ImportFieldSpec } from '@/components';
import { todayKey } from '@/lib/date';
import { readDocumentText } from '@/lib/readDocumentText';
import { useCategories } from '@/modules/categories';
import {
  PRIORITY_ORDER,
  RecurringTaskListItem,
  TaskListItem,
  TaskLogSheet,
  parseTasksCsv,
  useAllTaskLabelLinks,
  useRecurringTasks,
  useTaskLabels,
  useTasks,
} from '@/modules/tasks';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { useAppTheme } from '@/theme';

const CSV_MIME_TYPES = ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'];

/** Mirrors exactly what modules/tasks/importTasksCsv.ts reads — keep in sync with that file if
 * its column matching ever changes. */
const TASKS_IMPORT_FIELDS: ImportFieldSpec[] = [
  { column: 'title', aliases: ['task'], required: true, format: 'Text.', example: 'Renew passport' },
  { column: 'notes', aliases: ['description'], required: false, format: 'Text.', example: 'Bring old passport + 2 photos' },
  { column: 'priority', required: false, format: 'One of: low, medium, high. Defaults to medium.', example: 'high' },
  { column: 'category', required: false, format: 'Text — must match one of your existing task category names (case-insensitive).', example: 'Errands' },
  {
    column: 'duedate',
    aliases: ['date'],
    required: false,
    format: 'YYYY-MM-DD, or any date format JavaScript can parse. One-off tasks only — ignored for recurring rows.',
    example: '2026-10-05',
  },
  {
    column: 'recurring',
    required: false,
    format: 'yes/no. A row is also treated as recurring if it has a valid "frequency" value, even without this column.',
    example: 'yes',
  },
  {
    column: 'frequency',
    required: false,
    format: 'One of: daily, weekly, monthly, periodic. Only used for recurring rows — defaults to daily.',
    example: 'weekly',
  },
  {
    column: 'days',
    aliases: ['weekdays'],
    required: false,
    format: 'Comma-separated weekday names/abbreviations, e.g. "Mon,Wed,Fri". Only used when frequency is weekly.',
    example: 'Mon,Wed,Fri',
  },
];

type FilterKey = 'all' | number;
type LabelFilterKey = 'all' | string;
type SortKey = 'priority' | 'dueDate';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'dueDate', label: 'Due date' },
];

// useTasks' own SQL query already orders by priority first (see useTasks.ts's orderBy) — that's
// this screen's default and needs no client-side re-sort. Picking "Due date" instead re-sorts
// the same completed-last rows by due date first, priority only as the tiebreaker.
function sortByDueDate<T extends { completed_at: string | null; due_date: string | null; priority: 'high' | 'medium' | 'low' }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const aCompleted = a.completed_at ? 1 : 0;
    const bCompleted = b.completed_at ? 1 : 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;

    const aNoDue = a.due_date ? 0 : 1;
    const bNoDue = b.due_date ? 0 : 1;
    if (aNoDue !== bNoDue) return aNoDue - bNoDue;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;

    return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
  });
}

export default function TasksScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { tasks, loading, subtaskCounts, toggleComplete, archiveTask, removeTask, refresh, createTask } = useTasks();
  const {
    tasks: recurringTasks,
    loading: loadingRecurring,
    upsertCompletion,
    clearCompletion,
    moveRecurringTask,
    archiveRecurringTask,
    removeRecurringTask,
    createRecurringTask,
    refresh: refreshRecurring,
  } = useRecurringTasks();
  const { categories } = useCategories('task');
  const { labels } = useTaskLabels();
  const { labelIdsByTask } = useAllTaskLabelLinks();
  const [tab, setTab] = useState<'single' | 'recurring'>('single');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [labelFilter, setLabelFilter] = useState<LabelFilterKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sheetTaskId, setSheetTaskId] = useState<number | null>(null);
  const recurringGate = useFreeTierGate('recurringTasks');
  const taskGate = useFreeTierGate('tasks');
  const [upsellKind, setUpsellKind] = useState<'tasks' | 'recurringTasks' | null>(null);
  const [formatModalVisible, setFormatModalVisible] = useState(false);

  const sheetEntry = recurringTasks.find((entry) => entry.task.id === sheetTaskId);
  const refreshAll = async () => {
    await Promise.all([refresh(), refreshRecurring()]);
  };

  // Modal renders as a top-level overlay regardless of which tab is focused, so a sheet left
  // open here would otherwise keep floating over whichever tab you switch to next.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSheetTaskId(null);
        setUpsellKind(null);
      };
    }, [])
  );

  const onAddTask = (forceRecurring?: boolean) => {
    const wantsRecurring = forceRecurring ?? tab === 'recurring';
    if (wantsRecurring && !recurringGate.allowed) {
      setUpsellKind('recurringTasks');
      return;
    }
    if (!wantsRecurring && !taskGate.allowed) {
      setUpsellKind('tasks');
      return;
    }
    router.push({ pathname: '/tasks-new', params: wantsRecurring ? { recurring: '1' } : {} });
  };

  const onImportCsv = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: CSV_MIME_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const text = await readDocumentText(result.assets[0]);
    const { oneOffRows, recurringRows, total, skipped } = parseTasksCsv(text, categories);
    const importCount = oneOffRows.length + recurringRows.length;

    if (importCount === 0) {
      showAlert('Nothing to import', 'No rows had a "title" column. Check your CSV format.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View CSV format', onPress: () => setFormatModalVisible(true) },
      ]);
      return;
    }

    showAlert(
      `Import ${importCount} task${importCount === 1 ? '' : 's'}?`,
      `${oneOffRows.length} one-off, ${recurringRows.length} recurring.` + (skipped > 0 ? ` ${skipped} of ${total} rows were skipped (missing title).` : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            for (const row of oneOffRows) {
              await createTask(row);
            }
            for (const row of recurringRows) {
              await createRecurringTask(row);
            }
            await refreshAll();
            showAlert('Imported', `Added ${importCount} task${importCount === 1 ? '' : 's'}.`);
          },
        },
      ]
    );
  };

  const onMenu = () => {
    showAlert('Tasks', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'CSV/Excel format', onPress: () => setFormatModalVisible(true) },
      { text: 'Import CSV', onPress: onImportCsv },
    ]);
  };

  const changeTab = (next: 'single' | 'recurring') => {
    setTab(next);
    setFilter('all');
    setLabelFilter('all');
  };

  const usedCategoryIds = new Set(
    (tab === 'single' ? tasks : recurringTasks.map((r) => r.task)).map((t) => t.category_id).filter((id): id is number => id != null)
  );
  const usedCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  const usedLabelIds = new Set(
    (tab === 'single' ? tasks : recurringTasks.map((r) => r.task)).flatMap((t) => labelIdsByTask[t.id] ?? [])
  );
  const usedLabels = labels.filter((l) => usedLabelIds.has(l.id));
  const hasLabel = (taskId: number) => labelFilter === 'all' || (labelIdsByTask[taskId] ?? []).includes(labelFilter);

  const categoryFilteredTasks = filter === 'all' ? tasks : tasks.filter((t) => t.category_id === filter);
  const categoryFilteredRecurring = filter === 'all' ? recurringTasks : recurringTasks.filter(({ task }) => task.category_id === filter);
  const labelFilteredTasks = categoryFilteredTasks.filter((t) => hasLabel(t.id));
  const filteredRecurring = categoryFilteredRecurring.filter(({ task }) => hasLabel(task.id));
  const filteredTasks = sortKey === 'dueDate' ? sortByDueDate(labelFilteredTasks) : labelFilteredTasks;
  // A blocking task is always one-time and not yet archived (see TaskForm's picker pool), so it
  // always shows up in this same `tasks` array — no separate fetch needed to resolve the link.
  const tasksById = new Map(tasks.map((t) => [t.id, t]));

  return (
    <View style={{ flex: 1 }}>
    <ScreenContainer onRefresh={refreshAll}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Pressable hitSlop={8} onPress={onMenu}>
                <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => onAddTask()}>
                <Ionicons name="add-circle" size={28} color={theme.colors.moduleTasks} />
              </Pressable>
            </View>
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

        {usedLabels.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
            <Chip label="All labels" selected={labelFilter === 'all'} onPress={() => setLabelFilter('all')} />
            {usedLabels.map((label) => (
              <Chip key={label.id} label={label.name} selected={labelFilter === label.id} color={label.color} onPress={() => setLabelFilter(label.id)} />
            ))}
          </ScrollView>
        ) : null}

        {tab === 'single' && tasks.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Sort by</Text>
            {SORT_OPTIONS.map((option) => (
              <Chip key={option.key} label={option.label} selected={sortKey === option.key} onPress={() => setSortKey(option.key)} />
            ))}
          </View>
        ) : null}

        {tab === 'single' ? (
          !loading && filteredTasks.length === 0 ? (
            <EmptyState
              icon="checkbox-outline"
              title={tasks.length === 0 ? 'No tasks yet' : 'Nothing in this list'}
              subtitle={tasks.length === 0 ? 'Add a to-do with a priority and due date to get started.' : undefined}
              ctaLabel={tasks.length === 0 ? 'Add your first task' : undefined}
              onPressCta={tasks.length === 0 ? () => onAddTask(false) : undefined}
            />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {filteredTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  subtaskCount={subtaskCounts[task.id]}
                  category={categories.find((c) => c.id === task.category_id)}
                  blockingTask={task.blocked_by_task_id ? tasksById.get(task.blocked_by_task_id) : null}
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
            onPressCta={recurringTasks.length === 0 ? () => onAddTask(true) : undefined}
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
                  onSkipToday={due && !todayLog ? () => upsertCompletion(task.id, { status: 'skip' }) : undefined}
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

      <UpsellModal
        visible={upsellKind !== null}
        resourceLabel={upsellKind ? LIMIT_LABELS[upsellKind] : ''}
        limit={upsellKind === 'tasks' ? taskGate.limit : recurringGate.limit}
        onClose={() => setUpsellKind(null)}
      />

      <ImportFormatModal
        visible={formatModalVisible}
        onClose={() => setFormatModalVisible(false)}
        title="Tasks CSV format"
        intro="Header row required. Column names are case-insensitive."
        fields={TASKS_IMPORT_FIELDS}
      />
    </ScreenContainer>
    </View>
  );
}
