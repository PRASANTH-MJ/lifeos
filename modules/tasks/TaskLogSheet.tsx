import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
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

  const openDetail = (tab: 'calendar' | 'statistics' | 'edit') => {
    onClose();
    router.push({ pathname: '/tasks/[id]', params: { id: String(task.id), tab } });
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

          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md }}>
            {(
              [
                { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
                { key: 'statistics', label: 'Statistics', icon: 'stats-chart-outline' },
                { key: 'edit', label: 'Edit', icon: 'create-outline' },
              ] as const
            ).map((entry) => (
              <Pressable
                key={entry.key}
                onPress={() => openDetail(entry.key)}
                style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: theme.spacing.xs }}>
                <Ionicons name={entry.icon} size={20} color={theme.colors.textTertiary} />
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                  {entry.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
