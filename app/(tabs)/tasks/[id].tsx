import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, DonutChart, IconBadge, Legend, LoadingState, RangeChip, ScreenContainer, SegmentedControl, TextField, TrendChart, showAlert } from '@/components';
import { addDays, buildMonthGrid, formatDisplayDate, monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { useCategories } from '@/modules/categories';
import { STREAK_CHALLENGE_TIERS, monthlyDoneCounts, rangeBounds, tallyStatus, type RangeKey } from '@/modules/habits';
import { formatTimeDisplay, useSettings } from '@/modules/settings';
import { formatDurationShort, useTimeSpent } from '@/modules/timer';
import {
  PriorityChip,
  TaskForm,
  TaskLogSheet,
  clearOneTimeTaskLog,
  logOneTimeTaskStatus,
  reminderOffsetLabel,
  useTaskDetail,
  useTaskLabelLinks,
  type TaskCompletion,
  type TaskLogStatus,
} from '@/modules/tasks';
import { useAppTheme } from '@/theme';

type DetailTab = 'calendar' | 'statistics' | 'edit';

const STATUS_COLOR = (theme: ReturnType<typeof useAppTheme>, status?: TaskLogStatus) =>
  status === 'done' ? theme.colors.success : status === 'fail' ? theme.colors.danger : status === 'skip' ? theme.colors.textTertiary : theme.colors.border;

export default function TaskDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: DetailTab }>();
  const taskId = Number(id);
  const {
    task,
    subtasks,
    completions,
    periodProgress,
    streak,
    longestStreak,
    blockingTask,
    isBlocked,
    loading,
    updateTask,
    toggleComplete,
    addSubtask,
    toggleSubtask,
    archiveTask,
    deleteTask,
    clearCompletionHistory,
    upsertCompletion,
    clearCompletion,
  } = useTaskDetail(taskId);
  const { categories } = useCategories('task');
  const { settings } = useSettings();
  const { setLabelsFor } = useTaskLabelLinks(taskId);
  const { totalSeconds: timeSpentTotalSeconds, todaySeconds: timeSpentTodaySeconds } = useTimeSpent({ taskId });

  const [tab, setTab] = useState<DetailTab>(initialTab ?? 'calendar');
  const [newSubtask, setNewSubtask] = useState('');
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => monthCursorOf(todayKey()));
  const [statsRange, setStatsRange] = useState<RangeKey>('month');

  const completionByDate = useMemo(() => new Map(completions.map((c) => [c.date, c])), [completions]);
  const markedDates = useMemo(() => {
    const marks = new Set(completions.map((c) => c.date));
    if (task?.due_date) marks.add(task.due_date);
    return marks;
  }, [completions, task?.due_date]);

  if (loading || !task) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const category = categories.find((c) => c.id === task.category_id);
  const completed = Boolean(task.completed_at);
  const displayTime = formatTimeDisplay(task.due_time, settings?.timeFormat ?? '24h');
  // Mandatory: every checklist item (subtask) must be checked off before this task can be marked
  // complete — mirrors the same gate in TaskLogSheet's "Done" button.
  const checklistIncomplete = subtasks.some((subtask) => !subtask.completed_at);
  const checklistCheckedCount = subtasks.filter((subtask) => subtask.completed_at).length;

  const onAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    await addSubtask(newSubtask.trim());
    setNewSubtask('');
  };

  const onToggleComplete = () => {
    if (!completed && isBlocked) {
      showAlert('Blocked', `This task is blocked by "${blockingTask?.title}". Complete that task first.`, [{ text: 'OK' }]);
      return;
    }
    if (!completed && checklistIncomplete) {
      showAlert(
        'Checklist incomplete',
        `Check off every checklist item before marking this task complete (${checklistCheckedCount} of ${subtasks.length} so far).`,
        [{ text: 'OK' }]
      );
      return;
    }
    toggleComplete();
  };

  const onArchive = () => {
    showAlert('Archive task?', 'It will be removed from your task list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: async () => { await archiveTask(); router.back(); } },
    ]);
  };

  const onClearHistory = () => {
    showAlert('Clear completion history?', 'This clears all logged done/fail/skip entries for this task. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearCompletionHistory() },
    ]);
  };

  const onDelete = () => {
    showAlert('Delete task?', 'This permanently deletes the task and its history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTask(); router.back(); } },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
            {!task.is_recurring ? (
              <Pressable
                onPress={onToggleComplete}
                hitSlop={8}
                accessibilityLabel={
                  !completed && isBlocked
                    ? `${task.title} is blocked`
                    : !completed && checklistIncomplete
                      ? `${task.title} checklist is incomplete`
                      : completed
                        ? `Mark ${task.title} incomplete`
                        : `Mark ${task.title} complete`
                }
                style={{
                  width: 28,
                  height: 28,
                  marginTop: 2,
                  borderRadius: theme.radius.full,
                  borderWidth: 2,
                  borderColor: completed ? theme.colors.success : isBlocked || checklistIncomplete ? theme.colors.textTertiary : theme.colors.border,
                  backgroundColor: completed ? theme.colors.success : 'transparent',
                  opacity: !completed && (isBlocked || checklistIncomplete) ? 0.5 : 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {completed ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {task.important ? <Ionicons name="star" size={16} color={theme.colors.warning} /> : null}
                <Text
                  style={{
                    color: completed ? theme.colors.textTertiary : theme.colors.textPrimary,
                    fontSize: theme.typography.size.xl,
                    fontWeight: theme.typography.weight.bold,
                    textDecorationLine: completed ? 'line-through' : 'none',
                  }}>
                  {task.title}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xs, flexWrap: 'wrap' }}>
                <PriorityChip priority={task.priority} />
                {category ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name={category.icon as never} size={12} color={category.color} />
                    <Text style={{ color: category.color, fontSize: theme.typography.size.sm }}>{category.name}</Text>
                  </View>
                ) : null}
                {task.is_recurring ? (
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                    {task.recurrence_frequency === 'daily' ? 'Every day' : task.recurrence_frequency === 'monthly' ? 'Monthly' : task.recurrence_frequency === 'periodic' ? 'Periodic' : 'Specific days'}
                  </Text>
                ) : task.due_date ? (
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                    Due {formatDisplayDate(task.due_date)}
                    {displayTime ? ` · ${displayTime}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
            {task.is_recurring ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="flame" size={16} color={theme.colors.warning} />
                  <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>{streak}</Text>
                </View>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>streak</Text>
              </View>
            ) : null}
          </View>

          {isBlocked ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.warningMuted, borderColor: theme.colors.warningMuted }}>
              <IconBadge name="lock-closed" color={theme.colors.warning} size="sm" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>
                Blocked by: {blockingTask?.title}
              </Text>
            </Card>
          ) : !completed && checklistIncomplete && subtasks.length > 0 ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.warningMuted, borderColor: theme.colors.warningMuted }}>
              <IconBadge name="checkbox-outline" color={theme.colors.warning} size="sm" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>
                Check off every checklist item before marking this task complete ({checklistCheckedCount} of {subtasks.length}).
              </Text>
            </Card>
          ) : null}

          {task.notes ? (
            <Card>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>{task.notes}</Text>
            </Card>
          ) : null}

          {!task.is_recurring && (task.reminder_offset_minutes != null || task.alarm_enabled) ? (
            <Card style={{ gap: theme.spacing.sm }}>
              {task.reminder_offset_minutes != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <IconBadge name="notifications" tone="neutral" size="sm" />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>
                    Reminder — {reminderOffsetLabel(task.reminder_offset_minutes)}
                  </Text>
                </View>
              ) : null}
              {task.alarm_enabled ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <IconBadge name="alarm" tone="neutral" size="sm" />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>Alarm at due time</Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {task.is_recurring && task.recurrence_frequency === 'periodic' && task.period_target_count ? (
            <Card style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
                {periodProgress ?? 0}/{task.period_target_count}
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>This {task.period_length_days}-day period</Text>
            </Card>
          ) : null}

          {!completed ? (
            <Pressable
              onPress={() => router.push({ pathname: '/timer', params: { taskId: String(task.id), taskTitle: task.title } })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <IconBadge name="timer-outline" color={theme.colors.moduleTasks} size="md" />
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
                  Focus on this
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
              </Card>
            </Pressable>
          ) : null}

          {timeSpentTotalSeconds > 0 ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="time-outline" color={theme.colors.moduleTasks} size="md" />
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
                Today: {formatDurationShort(timeSpentTodaySeconds)} · All time: {formatDurationShort(timeSpentTotalSeconds)}
              </Text>
            </Card>
          ) : null}

          <SegmentedControl
            options={[
              { value: 'calendar', label: 'Calendar' },
              { value: 'statistics', label: 'Statistics' },
              { value: 'edit', label: 'Edit' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'calendar' ? (
            <View style={{ gap: theme.spacing.lg }}>
              <Card>
                <CalendarMonthGrid
                  year={monthCursor.year}
                  month={monthCursor.month}
                  selectedDate={todayKey()}
                  markedDates={markedDates}
                  onSelectDate={setSheetDate}
                  onChangeMonth={(delta) => setMonthCursor((cursor) => shiftMonth(cursor, delta))}
                />
              </Card>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>Tap any date to log it</Text>
            </View>
          ) : null}

          {tab === 'statistics' ? (
            <StatisticsTab
              completions={completions}
              range={statsRange}
              onChangeRange={setStatsRange}
              longestStreak={longestStreak}
              isRecurring={Boolean(task.is_recurring)}
            />
          ) : null}

          {tab === 'edit' ? (
            <View style={{ gap: theme.spacing.xl }}>
              <TaskForm
                task={task}
                submitLabel="Save changes"
                onSave={async (values, _checklistItems, labelIds) => {
                  await updateTask({
                    title: values.title,
                    notes: values.notes,
                    priority: values.priority,
                    category_id: values.categoryId,
                    important: values.important ? 1 : 0,
                    due_date: values.dueDate,
                    due_time: values.dueTime,
                    reminder_offset_minutes: values.reminderOffsetMinutes,
                    alarm_enabled: values.alarmEnabled ? 1 : 0,
                    recurrence_frequency: values.isRecurring ? values.recurrenceFrequency : null,
                    recurrence_days: JSON.stringify(values.recurrenceDays),
                    period_target_count: values.periodTargetCount,
                    period_length_days: values.periodLengthDays,
                    blocked_by_task_id: values.blockedByTaskId,
                  });
                  await setLabelsFor(taskId, labelIds);
                }}
                extraActions={
                  <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                    <Button label="Clear completion history" variant="secondary" onPress={onClearHistory} />
                    <Button label="Archive task" variant="secondary" onPress={onArchive} />
                    <Button label="Delete task" variant="danger" onPress={onDelete} />
                  </View>
                }
              />

              {!task.is_recurring ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    Subtasks
                  </Text>
                  {subtasks.map((subtask) => (
                    <Pressable key={subtask.id} onPress={() => toggleSubtask(subtask)} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Ionicons
                        name={subtask.completed_at ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={subtask.completed_at ? theme.colors.success : theme.colors.textTertiary}
                      />
                      <Text
                        style={{
                          color: subtask.completed_at ? theme.colors.textTertiary : theme.colors.textPrimary,
                          fontSize: theme.typography.size.base,
                          textDecorationLine: subtask.completed_at ? 'line-through' : 'none',
                        }}>
                        {subtask.title}
                      </Text>
                    </Pressable>
                  ))}
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
                    <View style={{ flex: 1 }}>
                      <TextField placeholder="Add a subtask" value={newSubtask} onChangeText={setNewSubtask} onSubmitEditing={onAddSubtask} returnKeyType="done" />
                    </View>
                    <Pressable onPress={onAddSubtask} hitSlop={8} style={{ padding: theme.spacing.sm }}>
                      <Ionicons name="add-circle" size={30} color={theme.colors.moduleTasks} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
      </View>

      {sheetDate ? (
        <TaskLogSheet
          visible
          task={task}
          date={sheetDate}
          existingLog={completionByDate.get(sheetDate)}
          onClose={() => setSheetDate(null)}
          onSave={async (status) => {
            if (task.is_recurring) {
              await upsertCompletion(sheetDate, status);
            } else {
              await logOneTimeTaskStatus(db, task, status, sheetDate, toggleComplete);
            }
            setSheetDate(null);
          }}
          onClear={async () => {
            if (task.is_recurring) {
              await clearCompletion(sheetDate);
            } else {
              await clearOneTimeTaskLog(db, task, sheetDate, toggleComplete);
            }
            setSheetDate(null);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

function StatisticsTab({
  completions,
  range,
  onChangeRange,
  longestStreak,
  isRecurring,
}: {
  completions: TaskCompletion[];
  range: RangeKey;
  onChangeRange: (range: RangeKey) => void;
  longestStreak: number;
  isRecurring: boolean;
}) {
  const theme = useAppTheme();
  const { start, end } = rangeBounds(range);
  const counts = tallyStatus(completions, start, end);
  const total = counts.done + counts.fail + counts.skip;

  const dotDays =
    range === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(todayKey(), -(6 - i)))
      : range === 'month'
        ? buildMonthGrid(Number(todayKey().split('-')[0]), Number(todayKey().split('-')[1]) - 1).filter((d) => d.startsWith(todayKey().slice(0, 7)))
        : [];

  const statusByDate = new Map(completions.map((c) => [c.date, c.status]));
  const barData = monthlyDoneCounts(
    completions.map((c) => ({ date: c.date, status: c.status })) as never,
    12
  );

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {(['week', 'month', 'year'] as RangeKey[]).map((key) => (
          <RangeChip key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} selected={range === key} onPress={() => onChangeRange(key)} />
        ))}
      </View>

      {range !== 'year' ? (
        <Card style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {range === 'week' ? 'This week' : 'This month'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {dotDays.map((dateKey) => (
              <View
                key={dateKey}
                style={{
                  width: range === 'week' ? 28 : 16,
                  height: range === 'week' ? 28 : 16,
                  borderRadius: theme.radius.full,
                  backgroundColor: STATUS_COLOR(theme, statusByDate.get(dateKey)),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {range === 'week' ? <Text style={{ color: theme.colors.textPrimary, fontSize: 10 }}>{Number(dateKey.split('-')[2])}</Text> : null}
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <Card>
          <TrendChart label="Completions per month" data={barData.map((b) => ({ date: b.label, value: b.value }))} color={theme.colors.moduleTasks} />
        </Card>
      )}

      <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          Success vs. fail
        </Text>
        <DonutChart
          segments={[
            { value: counts.done, color: theme.colors.success },
            { value: counts.fail, color: theme.colors.danger },
            { value: counts.skip, color: theme.colors.textTertiary },
          ]}
          centerLabel={total > 0 ? `${Math.round((counts.done / total) * 100)}%` : '—'}
          centerSubLabel="done"
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          <Legend color={theme.colors.success} label={`Done ${counts.done}`} />
          <Legend color={theme.colors.danger} label={`Fail ${counts.fail}`} />
          <Legend color={theme.colors.textTertiary} label={`Skip ${counts.skip}`} />
        </View>
      </Card>

      {isRecurring ? (
        <Card style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Streak challenges
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            {STREAK_CHALLENGE_TIERS.map((tier) => {
              const unlocked = longestStreak >= tier.days;
              return (
                <View
                  key={tier.days}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 4,
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor: unlocked ? theme.colors.warningMuted : theme.colors.background,
                    borderWidth: 1,
                    borderColor: unlocked ? theme.colors.warning : theme.colors.border,
                  }}>
                  <IconBadge
                    name={unlocked ? 'trophy' : 'lock-closed'}
                    color={theme.colors.warning}
                    tone={unlocked ? 'tinted' : 'neutral'}
                    size="sm"
                  />
                  <Text
                    style={{
                      color: unlocked ? theme.colors.textPrimary : theme.colors.textTertiary,
                      fontSize: theme.typography.size.xs,
                      fontWeight: theme.typography.weight.medium,
                      textAlign: 'center',
                    }}>
                    {tier.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
