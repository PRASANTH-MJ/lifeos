import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, TextField } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { useAppTheme } from '@/theme';
import { parseChecklistChecked, parseChecklistItems, type Habit, type HabitLog, type LogStatus } from './types';
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
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}>
          <View>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {habit.name}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{formatDisplayDate(date)}</Text>
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

          <TextField label="Note" placeholder="Add a note" value={note} onChangeText={setNote} />

          <Button label="Save" onPress={() => onSaveStatus(status ?? 'done')} loading={saving} disabled={!status} />

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
      </View>
    </Modal>
  );
}
