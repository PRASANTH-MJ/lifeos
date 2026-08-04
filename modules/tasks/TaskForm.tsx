import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Switch, Text, View } from 'react-native';

import { Button, Chip, TextField, TimeField } from '@/components';
import { formatDisplayDate, monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { CategoryPicker, useCategories } from '@/modules/categories';
import { FREQUENCY_LABELS, MONTH_DAY_OPTIONS, WEEKDAY_LABELS } from '@/modules/habits';
import { useAppTheme } from '@/theme';
import { REMINDER_OFFSET_OPTIONS, reminderOffsetLabel } from './scheduleTaskNotifications';
import { parseRecurrenceDays, type RecurrenceFrequency, type Task, type TaskPriority } from './types';

const RECURRENCE_FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'periodic'];

export type TaskFormValues = {
  title: string;
  notes: string | null;
  priority: TaskPriority;
  categoryId: number | null;
  important: boolean;
  isRecurring: boolean;
  dueDate: string | null;
  dueTime: string | null;
  reminderOffsetMinutes: number | null;
  alarmEnabled: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceDays: number[];
  periodTargetCount: number | null;
  periodLengthDays: number | null;
};

type Props = {
  task?: Task | null;
  onSave: (values: TaskFormValues, checklistItems: string[]) => Promise<void>;
  submitLabel: string;
  autoFocusTitle?: boolean;
  showChecklist?: boolean;
  initialRecurring?: boolean;
  lockRecurring?: boolean;
  extraActions?: React.ReactNode;
};

export function TaskForm({
  task,
  onSave,
  submitLabel,
  autoFocusTitle = false,
  showChecklist = false,
  initialRecurring = false,
  lockRecurring = false,
  extraActions,
}: Props) {
  const theme = useAppTheme();
  const { categories, createCategory } = useCategories('task');

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [important, setImportant] = useState(false);
  const [isRecurring, setIsRecurring] = useState(initialRecurring);
  const [dueDate, setDueDate] = useState<string | null>(todayKey());
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<number | null>(null);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('daily');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [periodTargetCount, setPeriodTargetCount] = useState('3');
  const [periodLengthDays, setPeriodLengthDays] = useState('7');
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(!task);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(todayKey()));

  useEffect(() => {
    if (task && !prefilled) {
      setTitle(task.title);
      setNotes(task.notes ?? '');
      setPriority(task.priority);
      setCategoryId(task.category_id);
      setImportant(Boolean(task.important));
      setIsRecurring(Boolean(task.is_recurring));
      setDueDate(task.due_date ?? todayKey());
      setDueTime(task.due_time);
      setReminderOffsetMinutes(task.reminder_offset_minutes);
      setAlarmEnabled(Boolean(task.alarm_enabled));
      if (task.recurrence_frequency) setRecurrenceFrequency(task.recurrence_frequency);
      setRecurrenceDays(parseRecurrenceDays(task.recurrence_days));
      setPeriodTargetCount(String(task.period_target_count ?? 3));
      setPeriodLengthDays(String(task.period_length_days ?? 7));
      setPrefilled(true);
    }
  }, [task, prefilled]);

  // "New Task" is a static route (app/(tabs)/tasks/new.tsx) — expo-router reuses the same screen
  // instance across repeated visits rather than mounting a fresh one each time, so a plain
  // useState default only resets once, ever. Re-blanking on every focus (skipped in edit mode,
  // where `task` is set) is what actually makes each "new task" session start empty.
  useFocusEffect(
    useCallback(() => {
      if (task) return;
      setTitle('');
      setNotes('');
      setPriority('medium');
      setCategoryId(null);
      setImportant(false);
      setIsRecurring(initialRecurring);
      setDueDate(todayKey());
      setDueTime(null);
      setReminderOffsetMinutes(null);
      setAlarmEnabled(false);
      setRecurrenceFrequency('daily');
      setRecurrenceDays([1, 2, 3, 4, 5]);
      setPeriodTargetCount('3');
      setPeriodLengthDays('7');
      setChecklistItems(['']);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task, initialRecurring])
  );

  const toggleRecurrenceDay = (day: number) => {
    setRecurrenceDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)));
  };
  const updateChecklistItem = (index: number, text: string) => setChecklistItems((items) => items.map((item, i) => (i === index ? text : item)));
  const addChecklistItem = () => setChecklistItems((items) => [...items, '']);
  const removeChecklistItem = (index: number) => setChecklistItems((items) => items.filter((_, i) => i !== index));

  if (task && !prefilled) {
    return null;
  }

  const canSave = title.trim().length > 0 && (isRecurring || Boolean(dueDate));

  const handleSave = async () => {
    setSaving(true);
    const values: TaskFormValues = {
      title: title.trim(),
      notes: notes.trim() || null,
      priority,
      categoryId,
      important,
      isRecurring,
      dueDate: isRecurring ? null : dueDate,
      dueTime: isRecurring ? null : dueTime,
      reminderOffsetMinutes: isRecurring ? null : reminderOffsetMinutes,
      alarmEnabled: isRecurring ? false : alarmEnabled,
      recurrenceFrequency,
      recurrenceDays: isRecurring ? recurrenceDays : [],
      periodTargetCount: isRecurring && recurrenceFrequency === 'periodic' ? Number(periodTargetCount) || null : null,
      periodLengthDays: isRecurring && recurrenceFrequency === 'periodic' ? Number(periodLengthDays) || null : null,
    };
    await onSave(values, checklistItems.map((item) => item.trim()).filter(Boolean));
    setSaving(false);
  };

  return (
    <>
    <View style={{ gap: theme.spacing.xl }}>
      <TextField label="Title" placeholder="e.g. Renew passport" value={title} onChangeText={setTitle} autoFocus={autoFocusTitle} />
      <TextField label="Notes (optional)" placeholder="Add details" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Ionicons name="star" size={18} color={theme.colors.warning} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>Important</Text>
        </View>
        <Switch value={important} onValueChange={setImportant} />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={sectionLabelStyle(theme)}>Priority</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {(['high', 'medium', 'low'] as TaskPriority[]).map((option) => (
            <Chip
              key={option}
              label={option.charAt(0).toUpperCase() + option.slice(1)}
              selected={priority === option}
              onPress={() => setPriority(option)}
              color={theme.colors.moduleTasks}
              mutedColor={theme.colors.moduleTasksMuted}
            />
          ))}
        </View>
      </View>

      {!lockRecurring ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>Recurring task</Text>
          <Switch value={isRecurring} onValueChange={setIsRecurring} />
        </View>
      ) : null}

      {isRecurring ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={sectionLabelStyle(theme)}>How often</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {RECURRENCE_FREQUENCIES.map((option) => (
              <Chip
                key={option}
                label={FREQUENCY_LABELS[option]}
                selected={recurrenceFrequency === option}
                onPress={() => setRecurrenceFrequency(option)}
                color={theme.colors.moduleTasks}
                mutedColor={theme.colors.moduleTasksMuted}
              />
            ))}
          </View>
          {recurrenceFrequency === 'weekly' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {WEEKDAY_LABELS.map((label, day) => (
                <Chip key={label} label={label} selected={recurrenceDays.includes(day)} onPress={() => toggleRecurrenceDay(day)} color={theme.colors.moduleTasks} mutedColor={theme.colors.moduleTasksMuted} />
              ))}
            </View>
          ) : null}
          {recurrenceFrequency === 'monthly' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {MONTH_DAY_OPTIONS.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => toggleRecurrenceDay(day)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: theme.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: recurrenceDays.includes(day) ? theme.colors.moduleTasksMuted : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: recurrenceDays.includes(day) ? theme.colors.moduleTasks : theme.colors.border,
                  }}>
                  <Text style={{ color: recurrenceDays.includes(day) ? theme.colors.moduleTasks : theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>
                    {day}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {recurrenceFrequency === 'periodic' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary }}>At least</Text>
              <View style={{ width: 56 }}>
                <TextField value={periodTargetCount} onChangeText={setPeriodTargetCount} keyboardType="number-pad" />
              </View>
              <Text style={{ color: theme.colors.textSecondary }}>times per</Text>
              <View style={{ width: 56 }}>
                <TextField value={periodLengthDays} onChangeText={setPeriodLengthDays} keyboardType="number-pad" />
              </View>
              <Text style={{ color: theme.colors.textSecondary }}>days</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={sectionLabelStyle(theme)}>Due date</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Pressable
              onPress={() => {
                setDateCursor(monthCursorOf(dueDate ?? todayKey()));
                setDatePickerVisible(true);
              }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: dueDate ? theme.colors.moduleTasks : theme.colors.border,
                backgroundColor: dueDate ? theme.colors.moduleTasksMuted : theme.colors.surface,
              }}>
              <Ionicons name="calendar-outline" size={18} color={theme.colors.moduleTasks} />
              <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.base }}>
                {formatDisplayDate(dueDate ?? todayKey())}
              </Text>
            </Pressable>
          </View>
          <TimeField label="Time (optional)" value={dueTime} onChange={setDueTime} />

          {dueDate && dueTime ? (
            <>
              <Text style={sectionLabelStyle(theme)}>Reminder</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                <Chip
                  label="None"
                  selected={reminderOffsetMinutes === null}
                  onPress={() => setReminderOffsetMinutes(null)}
                  color={theme.colors.moduleTasks}
                  mutedColor={theme.colors.moduleTasksMuted}
                />
                {REMINDER_OFFSET_OPTIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    label={reminderOffsetLabel(minutes)}
                    selected={reminderOffsetMinutes === minutes}
                    onPress={() => setReminderOffsetMinutes(minutes)}
                    color={theme.colors.moduleTasks}
                    mutedColor={theme.colors.moduleTasksMuted}
                  />
                ))}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Ionicons name="alarm" size={18} color={theme.colors.textSecondary} />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>Alarm at due time</Text>
                </View>
                <Switch value={alarmEnabled} onValueChange={setAlarmEnabled} />
              </View>
            </>
          ) : (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Set a date and time to enable a reminder or alarm.
            </Text>
          )}
        </View>
      )}

      {showChecklist && !isRecurring ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={sectionLabelStyle(theme)}>Checklist (optional)</Text>
          {checklistItems.map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField placeholder="Item name" value={item} onChangeText={(text) => updateChecklistItem(index, text)} />
              </View>
              <Pressable onPress={() => removeChecklistItem(index)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addChecklistItem}>
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Add item</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={sectionLabelStyle(theme)}>Category</Text>
        <CategoryPicker categories={categories} selectedId={categoryId} onSelect={setCategoryId} onCreate={createCategory} appliesTo="task" />
      </View>

      <Button label={submitLabel} onPress={handleSave} disabled={!canSave} loading={saving} />

      {extraActions}
    </View>

    <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}>
          <CalendarMonthGrid
            year={dateCursor.year}
            month={dateCursor.month}
            selectedDate={dueDate ?? todayKey()}
            markedDates={new Set(dueDate ? [dueDate] : [])}
            onSelectDate={(dateKey) => {
              setDueDate(dateKey);
              setDatePickerVisible(false);
            }}
            onChangeMonth={(delta) => setDateCursor((cursor) => shiftMonth(cursor, delta))}
          />
        </View>
      </View>
    </Modal>
    </>
  );
}

function sectionLabelStyle(theme: ReturnType<typeof useAppTheme>) {
  return { color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium };
}
