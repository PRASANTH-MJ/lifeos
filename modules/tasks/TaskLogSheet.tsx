import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { formatTimeDisplay, useSettings } from '@/modules/settings';
import { useAppTheme } from '@/theme';
import { useTaskDetail } from './useTaskDetail';
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
  // Subtasks double as this app's task checklist (see modules/tasks/useTaskDetail.ts) — shown
  // here too, not just on the full detail page, so checking them off doesn't require leaving
  // this quick popup first. isBlocked/blockingTask ride along on the same hook call, for the
  // "Done" button below.
  const { subtasks, toggleSubtask, isBlocked, blockingTask } = useTaskDetail(task.id);
  // Mandatory: every checklist item (subtask) must be checked off before this task can be closed
  // as done — previously the checklist was purely advisory and "Done" ignored it entirely.
  const checklistIncomplete = subtasks.some((subtask) => !subtask.completed_at);

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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
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
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.colors.textTertiary} />
            </Pressable>
          </View>

          {subtasks.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Checklist ({subtasks.filter((s) => s.completed_at).length} of {subtasks.length})
              </Text>
              {subtasks.map((subtask) => (
                <Pressable
                  key={subtask.id}
                  onPress={() => toggleSubtask(subtask)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
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
            </View>
          ) : null}

          {isBlocked ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Blocked by "{blockingTask?.title}" — complete that task first to mark this one done.
            </Text>
          ) : checklistIncomplete ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Check off every checklist item first to mark this task done.
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button label="Done" onPress={() => save('done')} loading={saving} disabled={isBlocked || checklistIncomplete} />
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
