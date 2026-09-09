import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button, TextField } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { useAppTheme } from '@/theme';
import { COMPARATOR_LABELS, parseChecklistChecked, parseChecklistItems, type Habit, type HabitLog, type LogStatus } from './types';
import type { LogValues } from './useHabits';

type Props = {
  visible: boolean;
  habit: Habit;
  date: string;
  existingLog?: HabitLog;
  onClose: () => void;
  onSave: (values: LogValues) => Promise<void>;
  onClear: () => Promise<void>;
};

export function HabitLogSheet({ visible, habit, date, existingLog, onClose, onSave, onClear }: Props) {
  const theme = useAppTheme();
  const [status, setStatus] = useState<LogStatus | null>(null);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setStatus(existingLog?.status ?? null);
      setValue(existingLog?.value != null ? String(existingLog.value) : '');
      setNote(existingLog?.note ?? '');
      setChecked(parseChecklistChecked(existingLog?.checklist_checked ?? null));
    }
  }, [visible, existingLog]);

  const checklistItems = parseChecklistItems(habit.checklist_items);

  const toggleChecked = (index: number) => {
    setChecked((current) => (current.includes(index) ? current.filter((i) => i !== index) : [...current, index]));
  };

  // Mandatory: a habit's own success criteria — the checklist_success_mode/checklist_min_count
  // fields, or the target_value/target_comparator numeric goal — must actually be met before
  // "Done" can be saved. These fields already existed but were purely decorative: HabitForm let
  // you configure them, but nothing here ever checked them, so "Done" always worked regardless.
  const numericValue = Number(value);
  const targetNotMet =
    (habit.tracking_type === 'numeric' || habit.tracking_type === 'timer') && habit.target_value != null
      ? value.trim() === '' || Number.isNaN(numericValue)
        ? true
        : habit.target_comparator === 'at_least'
          ? numericValue < habit.target_value
          : habit.target_comparator === 'at_most'
            ? numericValue > habit.target_value
            : numericValue !== habit.target_value
      : habit.tracking_type === 'checklist' && checklistItems.length > 0
        ? habit.checklist_success_mode === 'custom'
          ? checked.length < habit.checklist_min_count
          : checked.length < checklistItems.length
        : false;
  const targetHint =
    habit.tracking_type === 'numeric' || habit.tracking_type === 'timer'
      ? `Enter a value that is ${COMPARATOR_LABELS[habit.target_comparator].toLowerCase()} ${habit.target_value}${habit.target_unit ? ` ${habit.target_unit}` : ''} to mark this done.`
      : `Check off ${habit.checklist_success_mode === 'custom' ? `at least ${habit.checklist_min_count}` : 'every'} item${habit.checklist_success_mode === 'custom' && habit.checklist_min_count === 1 ? '' : 's'} to mark this done.`;

  const onSaveStatus = async (nextStatus: LogStatus) => {
    setSaving(true);
    await onSave({
      status: nextStatus,
      value: habit.tracking_type === 'numeric' || habit.tracking_type === 'timer' ? Number(value) || null : null,
      checklistChecked: habit.tracking_type === 'checklist' ? checked : null,
      note: note.trim() || null,
      date,
    });
    setSaving(false);
    onClose();
  };

  const onReset = async () => {
    setSaving(true);
    await onClear();
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                {habit.name}
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{formatDisplayDate(date)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.colors.textTertiary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {(['done', 'fail'] as LogStatus[]).map((option) => {
              const selected = status === option;
              const color = option === 'done' ? theme.colors.success : theme.colors.danger;
              const mutedColor = option === 'done' ? theme.colors.successMuted : theme.colors.dangerMuted;
              return (
                <Pressable
                  key={option}
                  onPress={() => setStatus(option)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: theme.spacing.md,
                    borderRadius: theme.radius.md,
                    backgroundColor: selected ? mutedColor : theme.colors.background,
                    borderWidth: 1,
                    borderColor: selected ? color : theme.colors.border,
                  }}>
                  <Text style={{ color: selected ? color : theme.colors.textSecondary, fontWeight: theme.typography.weight.semibold }}>
                    {option === 'done' ? 'Done' : 'Fail'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {habit.tracking_type === 'numeric' || habit.tracking_type === 'timer' ? (
            <TextField
              label={habit.tracking_type === 'timer' ? 'Minutes' : `Value${habit.target_unit ? ` (${habit.target_unit})` : ''}`}
              placeholder="0"
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
            />
          ) : null}

          {habit.tracking_type === 'checklist' && checklistItems.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Checklist ({checked.length} of {checklistItems.length})
              </Text>
              {checklistItems.map((item, index) => (
                <Pressable key={item} onPress={() => toggleChecked(index)} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Ionicons
                    name={checked.includes(index) ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={checked.includes(index) ? theme.colors.success : theme.colors.textTertiary}
                  />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{item}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {status === 'done' && targetNotMet ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{targetHint}</Text>
          ) : null}

          <TextField label="Note" placeholder="Add a note" value={note} onChangeText={setNote} />

          <Button
            label="Save"
            onPress={() => onSaveStatus(status ?? 'done')}
            loading={saving}
            disabled={!status || (status === 'done' && targetNotMet)}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={() => onSaveStatus('skip')}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Skip</Text>
            </Pressable>
            {existingLog ? (
              <Pressable onPress={onReset}>
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>Reset entry</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
