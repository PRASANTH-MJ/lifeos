import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, RowActionsMenu } from '@/components';
import { useAppTheme } from '@/theme';
import { formatDisplayDate } from '@/lib/date';
import type { Category } from '@/modules/categories';
import { formatTimeDisplay, useSettings } from '@/modules/settings';
import { PriorityChip } from './PriorityChip';
import type { Task } from './types';

type Props = {
  task: Task;
  subtaskCount?: { total: number; done: number };
  category?: Category;
  onToggle: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
};

export function TaskListItem({ task, subtaskCount, category, onToggle, onArchive, onDelete }: Props) {
  const theme = useAppTheme();
  const { settings } = useSettings();
  const completed = Boolean(task.completed_at);
  const displayTime = formatTimeDisplay(task.due_time, settings?.timeFormat ?? '24h');

  return (
    <Card style={styles.row}>
      <Pressable
        accessibilityLabel={completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
        onPress={onToggle}
        hitSlop={8}
        style={[
          styles.checkbox,
          {
            borderRadius: theme.radius.full,
            borderColor: completed ? theme.colors.success : theme.colors.border,
            backgroundColor: completed ? theme.colors.success : 'transparent',
          },
        ]}>
        {completed ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </Pressable>
      <Link href={{ pathname: '/tasks/[id]', params: { id: String(task.id) } }} asChild>
        <Pressable style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {task.important ? <Ionicons name="star" size={13} color={theme.colors.warning} /> : null}
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: completed ? theme.colors.textTertiary : theme.colors.textPrimary,
                fontSize: theme.typography.size.base,
                fontWeight: theme.typography.weight.semibold,
                textDecorationLine: completed ? 'line-through' : 'none',
              }}>
              {task.title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
            <PriorityChip priority={task.priority} />
            {category ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name={category.icon as never} size={11} color={category.color} />
                <Text style={{ color: category.color, fontSize: theme.typography.size.xs }}>{category.name}</Text>
              </View>
            ) : null}
            {task.due_date ? (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {formatDisplayDate(task.due_date)}
                {displayTime ? ` · ${displayTime}` : ''}
              </Text>
            ) : null}
            {task.reminder_offset_minutes != null ? <Ionicons name="notifications" size={13} color={theme.colors.textTertiary} /> : null}
            {task.alarm_enabled ? <Ionicons name="alarm" size={13} color={theme.colors.textTertiary} /> : null}
            {subtaskCount && subtaskCount.total > 0 ? (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {subtaskCount.done}/{subtaskCount.total} subtasks
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>
      {onDelete ? <RowActionsMenu itemLabel={task.title} onArchive={onArchive} onDelete={onDelete} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
