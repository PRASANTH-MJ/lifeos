import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { formatTimeDisplay, useSettings } from '@/modules/settings';
import { useAppTheme } from '@/theme';
import type { Task, TaskCompletion, TaskLogStatus } from './types';

type Props = {
  visible: boolean;
  task: Task;
  date: string;
  existingLog?: TaskCompletion;
  onClose: () => void;
  onSave: (status: TaskLogStatus) => Promise<void>;
  onClear: () => Promise<void>;
};

export function TaskLogSheet({ visible, task, date, existingLog, onClose, onSave, onClear }: Props) {
  const theme = useAppTheme();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);

  const save = async (status: TaskLogStatus) => {
    setSaving(true);
    await onSave(status);
    setSaving(false);
    onClose();
  };

  const reset = async () => {
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
              {task.title}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{formatDisplayDate(date)}</Text>
            {task.due_date ? (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, marginTop: 2 }}>
                Due {formatDisplayDate(task.due_date)}
                {task.due_time ? ` · ${formatTimeDisplay(task.due_time, settings?.timeFormat ?? '24h')}` : ''}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button label="Done" onPress={() => save('done')} loading={saving} />
            <Button label="Fail" variant="danger" onPress={() => save('fail')} loading={saving} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={() => save('skip')}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Skip</Text>
            </Pressable>
            {existingLog ? (
              <Pressable onPress={reset}>
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>Reset entry</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
