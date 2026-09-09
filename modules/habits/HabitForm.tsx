import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Button, Chip, TextField, TimeField } from '@/components';
import { CategoryPicker, useCategories } from '@/modules/categories';
import { useAppTheme } from '@/theme';
import {
  COMPARATOR_LABELS,
  FREQUENCY_LABELS,
  HABIT_ICONS,
  MONTH_DAY_OPTIONS,
  TRACKING_TYPE_LABELS,
  WEEKDAY_LABELS,
  parseChecklistItems,
  parseReminderTimes,
  parseTargetDays,
} from './types';
import { MAX_HABIT_REMINDER_TIMES } from './scheduleHabitNotifications';
import type { CreateHabitInput } from './useHabits';
import type { HabitTemplate } from './templates';
import type { Habit, HabitFrequency, TargetComparator, TrackingType } from './types';

const TRACKING_TYPES: TrackingType[] = ['yesno', 'numeric', 'timer', 'checklist'];
const FREQUENCIES: HabitFrequency[] = ['daily', 'weekly', 'monthly', 'periodic'];

type Props = {
  habit?: Habit | null;
  onSave: (values: CreateHabitInput) => Promise<void>;
  submitLabel: string;
  autoFocusName?: boolean;
  extraActions?: React.ReactNode;
  /** A template tapped on "Browse templates" (new-habit flow only — see app/habits-new.tsx) plus
   * a bump counter, so re-tapping the same template after editing fields away from it still
   * re-applies (a plain `template` dependency wouldn't re-fire the effect below, since the
   * templates array holds stable object references). */
  templateSelection?: { template: HabitTemplate; nonce: number } | null;
  /** Previously-used `routine_group` values across the user's other habits, for the "type or
   * reuse" autocomplete below the group field — omitted/empty just hides the suggestion chips. */
  existingGroups?: string[];
};

export function HabitForm({ habit, onSave, submitLabel, autoFocusName = false, extraActions, templateSelection, existingGroups = [] }: Props) {
  const theme = useAppTheme();
  const { categories, createCategory } = useCategories('habit');

  const [trackingType, setTrackingType] = useState<TrackingType>('yesno');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(HABIT_ICONS[0]);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [comparator, setComparator] = useState<TargetComparator>('at_least');
  const [checklistItems, setChecklistItems] = useState<string[]>(['', '']);
  const [checklistSuccessMode, setChecklistSuccessMode] = useState<'all' | 'custom'>('all');
  const [checklistMinCount, setChecklistMinCount] = useState('1');

  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [targetDays, setTargetDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [monthDays, setMonthDays] = useState<number[]>([1, 15]);
  const [periodTargetCount, setPeriodTargetCount] = useState('3');
  const [periodLengthDays, setPeriodLengthDays] = useState('7');

  // Each entry is a "HH:MM" time already committed by its TimeField, or null for a row the user
  // added but hasn't picked a time in yet — filtered out on save.
  const [reminderTimes, setReminderTimes] = useState<(string | null)[]>([]);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [routineGroup, setRoutineGroup] = useState('');

  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(!habit);
  // Defaults closed for a brand-new habit (the common "just add it" case shouldn't have to look
  // at icon/reminder/category), but starts open when editing a habit that already has any of
  // these set, so existing configuration is never hidden behind an extra tap.
  const [moreExpanded, setMoreExpanded] = useState(() => Boolean(habit?.reminder_time || habit?.category_id || habit?.routine_group));

  useEffect(() => {
    if (habit && !prefilled) {
      setTrackingType(habit.tracking_type);
      setName(habit.name);
      setIcon(habit.icon);
      setCategoryId(habit.category_id);
      setTargetValue(habit.target_value != null ? String(habit.target_value) : '');
      setTargetUnit(habit.target_unit ?? '');
      setComparator(habit.target_comparator);
      const items = parseChecklistItems(habit.checklist_items);
      setChecklistItems(items.length > 0 ? items : ['', '']);
      setChecklistSuccessMode(habit.checklist_success_mode);
      setChecklistMinCount(String(habit.checklist_min_count || 1));
      setFrequency(habit.frequency);
      const days = parseTargetDays(habit.target_days);
      if (habit.frequency === 'monthly') setMonthDays(days);
      else setTargetDays(days);
      setPeriodTargetCount(String(habit.period_target_count ?? 3));
      setPeriodLengthDays(String(habit.period_length_days ?? 7));
      setReminderTimes(parseReminderTimes(habit.reminder_time));
      setAlarmEnabled(Boolean(habit.alarm_enabled));
      setRoutineGroup(habit.routine_group ?? '');
      setPrefilled(true);
    }
  }, [habit, prefilled]);

  // Prefills from a tapped "Browse templates" card — new-habit flow only (`habit` is set in edit
  // mode, where there's no templates entry point). The user still reviews/edits every field and
  // taps Save themselves; nothing is created here.
  useEffect(() => {
    if (!templateSelection || habit) return;
    const { template } = templateSelection;
    setTrackingType(template.trackingType);
    setName(template.name);
    setIcon(template.icon);
    setTargetValue(template.targetValue != null ? String(template.targetValue) : '');
    setTargetUnit(template.targetUnit ?? '');
    setComparator(template.targetComparator ?? 'at_least');
    setFrequency(template.frequency);
    if (template.frequency === 'weekly' && template.targetDays) setTargetDays(template.targetDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateSelection?.nonce]);

  // "New Habit" is a static route (app/(tabs)/habits/new.tsx) — expo-router reuses the same
  // screen instance across repeated visits rather than mounting a fresh one each time, so a
  // plain useState default only resets once, ever. Re-blanking on every focus (skipped in edit
  // mode, where `habit` is set) is what actually makes each "new habit" session start empty.
  useFocusEffect(
    useCallback(() => {
      if (habit) return;
      setTrackingType('yesno');
      setName('');
      setIcon(HABIT_ICONS[0]);
      setCategoryId(null);
      setTargetValue('');
      setTargetUnit('');
      setComparator('at_least');
      setChecklistItems(['', '']);
      setChecklistSuccessMode('all');
      setChecklistMinCount('1');
      setFrequency('daily');
      setTargetDays([1, 2, 3, 4, 5]);
      setMonthDays([1, 15]);
      setPeriodTargetCount('3');
      setPeriodLengthDays('7');
      setReminderTimes([]);
      setAlarmEnabled(false);
      setRoutineGroup('');
      setMoreExpanded(false);
    }, [habit])
  );

  const toggleDay = (day: number) => {
    setTargetDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()));
  };
  const toggleMonthDay = (day: number) => {
    setMonthDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)));
  };
  const updateChecklistItem = (index: number, text: string) => {
    setChecklistItems((items) => items.map((item, i) => (i === index ? text : item)));
  };
  const addChecklistItem = () => setChecklistItems((items) => [...items, '']);
  const removeChecklistItem = (index: number) => setChecklistItems((items) => items.filter((_, i) => i !== index));

  const addReminderTime = () => setReminderTimes((times) => (times.length >= MAX_HABIT_REMINDER_TIMES ? times : [...times, null]));
  const removeReminderTime = (index: number) => setReminderTimes((times) => times.filter((_, i) => i !== index));
  const updateReminderTime = (index: number, value: string | null) =>
    setReminderTimes((times) => times.map((t, i) => (i === index ? value : t)));
  const confirmedReminderTimes = reminderTimes.filter((t): t is string => t !== null);

  if (habit && !prefilled) {
    return null;
  }

  const canSave =
    name.trim().length > 0 &&
    (frequency !== 'weekly' || targetDays.length > 0) &&
    (frequency !== 'monthly' || monthDays.length > 0) &&
    (trackingType !== 'checklist' || checklistItems.some((item) => item.trim().length > 0));

  const handleSave = async () => {
    setSaving(true);
    const values: CreateHabitInput = {
      name: name.trim(),
      icon,
      categoryId,
      trackingType,
      targetValue: targetValue.trim() ? Number(targetValue) : null,
      targetUnit: targetUnit.trim() || null,
      targetComparator: comparator,
      checklistItems: checklistItems.map((item) => item.trim()).filter(Boolean),
      checklistSuccessMode,
      checklistMinCount: Number(checklistMinCount) || 0,
      frequency,
      targetDays: frequency === 'weekly' ? targetDays : frequency === 'monthly' ? monthDays : [],
      periodTargetCount: frequency === 'periodic' ? Number(periodTargetCount) || null : null,
      periodLengthDays: frequency === 'periodic' ? Number(periodLengthDays) || null : null,
      reminderTimes: confirmedReminderTimes.slice().sort(),
      alarmEnabled,
      routineGroup: routineGroup.trim() || null,
    };
    await onSave(values);
    setSaving(false);
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text style={sectionLabelStyle(theme)}>How do you want to evaluate your progress?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {TRACKING_TYPES.map((option) => (
            <Chip
              key={option}
              label={TRACKING_TYPE_LABELS[option]}
              selected={trackingType === option}
              onPress={() => setTrackingType(option)}
              color={theme.colors.moduleHabits}
              mutedColor={theme.colors.moduleHabitsMuted}
            />
          ))}
        </View>
      </View>

      <TextField label="Name" placeholder="e.g. Drink water" value={name} onChangeText={setName} autoFocus={autoFocusName} />

      {trackingType === 'numeric' || trackingType === 'timer' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={sectionLabelStyle(theme)}>Goal</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {(['at_least', 'at_most', 'exactly'] as TargetComparator[]).map((option) => (
              <Chip
                key={option}
                label={COMPARATOR_LABELS[option]}
                selected={comparator === option}
                onPress={() => setComparator(option)}
                color={theme.colors.moduleHabits}
                mutedColor={theme.colors.moduleHabitsMuted}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                placeholder={trackingType === 'timer' ? 'Minutes' : 'Goal'}
                value={targetValue}
                onChangeText={setTargetValue}
                keyboardType="decimal-pad"
              />
            </View>
            {trackingType === 'numeric' ? (
              <View style={{ flex: 1 }}>
                <TextField placeholder="Unit (e.g. glasses)" value={targetUnit} onChangeText={setTargetUnit} />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {trackingType === 'checklist' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={sectionLabelStyle(theme)}>Checklist</Text>
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
            <Text style={{ color: theme.colors.moduleHabits, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Add item
            </Text>
          </Pressable>
          <Text style={sectionLabelStyle(theme)}>Success condition</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
            <Chip label="All items" selected={checklistSuccessMode === 'all'} onPress={() => setChecklistSuccessMode('all')} color={theme.colors.moduleHabits} mutedColor={theme.colors.moduleHabitsMuted} />
            <Chip label="Custom" selected={checklistSuccessMode === 'custom'} onPress={() => setChecklistSuccessMode('custom')} color={theme.colors.moduleHabits} mutedColor={theme.colors.moduleHabitsMuted} />
            {checklistSuccessMode === 'custom' ? (
              <View style={{ width: 60 }}>
                <TextField value={checklistMinCount} onChangeText={setChecklistMinCount} keyboardType="number-pad" />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={sectionLabelStyle(theme)}>How often do you want to do it?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {FREQUENCIES.map((option) => (
            <Chip
              key={option}
              label={FREQUENCY_LABELS[option]}
              selected={frequency === option}
              onPress={() => setFrequency(option)}
              color={theme.colors.moduleHabits}
              mutedColor={theme.colors.moduleHabitsMuted}
            />
          ))}
        </View>
      </View>

      {frequency === 'weekly' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {WEEKDAY_LABELS.map((label, day) => (
            <Chip key={label} label={label} selected={targetDays.includes(day)} onPress={() => toggleDay(day)} color={theme.colors.moduleHabits} mutedColor={theme.colors.moduleHabitsMuted} />
          ))}
        </View>
      ) : null}

      {frequency === 'monthly' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {MONTH_DAY_OPTIONS.map((day) => (
            <Pressable
              key={day}
              onPress={() => toggleMonthDay(day)}
              style={{
                width: 36,
                height: 36,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: monthDays.includes(day) ? theme.colors.moduleHabitsMuted : theme.colors.surface,
                borderWidth: 1,
                borderColor: monthDays.includes(day) ? theme.colors.moduleHabits : theme.colors.border,
              }}>
              <Text style={{ color: monthDays.includes(day) ? theme.colors.moduleHabits : theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>
                {day}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {frequency === 'periodic' ? (
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

      <Pressable onPress={() => setMoreExpanded((v) => !v)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
            More options
          </Text>
          <Ionicons name={moreExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textTertiary} />
        </View>
      </Pressable>

      {moreExpanded ? (
        <>
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={sectionLabelStyle(theme)}>Icon</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {HABIT_ICONS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setIcon(option)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: icon === option ? theme.colors.moduleHabitsMuted : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: icon === option ? theme.colors.moduleHabits : theme.colors.border,
                  }}>
                  <Ionicons name={option as never} size={20} color={icon === option ? theme.colors.moduleHabits : theme.colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={sectionLabelStyle(theme)}>Reminders</Text>
            {reminderTimes.map((time, index) => (
              <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <TimeField label={undefined} value={time} onChange={(value) => updateReminderTime(index, value)} />
                </View>
                <Pressable onPress={() => removeReminderTime(index)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                </Pressable>
              </View>
            ))}
            {reminderTimes.length < MAX_HABIT_REMINDER_TIMES ? (
              <Pressable onPress={addReminderTime}>
                <Text style={{ color: theme.colors.moduleHabits, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  {reminderTimes.length === 0 ? 'Add a reminder time' : 'Add another time'}
                </Text>
              </Pressable>
            ) : null}
            {confirmedReminderTimes.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Ionicons name="alarm" size={18} color={theme.colors.textSecondary} />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>Alarm</Text>
                </View>
                <Switch value={alarmEnabled} onValueChange={setAlarmEnabled} />
              </View>
            ) : (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                Add one or more times to get a daily reminder (and optionally an alarm) for this habit.
              </Text>
            )}
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={sectionLabelStyle(theme)}>Category</Text>
            <CategoryPicker categories={categories} selectedId={categoryId} onSelect={setCategoryId} onCreate={createCategory} appliesTo="habit" />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={sectionLabelStyle(theme)}>Routine group (optional)</Text>
            <TextField
              placeholder="e.g. Morning routine"
              value={routineGroup}
              onChangeText={setRoutineGroup}
            />
            {existingGroups.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {existingGroups
                  .filter((group) => group.toLowerCase() !== routineGroup.trim().toLowerCase())
                  .filter((group) => !routineGroup.trim() || group.toLowerCase().includes(routineGroup.trim().toLowerCase()))
                  .map((group) => (
                    <Chip key={group} label={group} selected={false} onPress={() => setRoutineGroup(group)} />
                  ))}
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <Button label={submitLabel} onPress={handleSave} disabled={!canSave} loading={saving} />

      {extraActions}
    </View>
  );
}

function sectionLabelStyle(theme: ReturnType<typeof useAppTheme>) {
  return { color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium };
}
