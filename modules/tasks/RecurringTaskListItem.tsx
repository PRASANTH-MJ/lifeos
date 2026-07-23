import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components';
import type { Category } from '@/modules/categories';
import { useAppTheme } from '@/theme';
import { PriorityChip } from './PriorityChip';
import type { Task, TaskCompletion } from './types';

type Props = {
  task: Task;
  todayLog?: TaskCompletion;
  due: boolean;
  periodProgress: number | null;
  category?: Category;
  onOpenLogSheet: () => void;
};

export function RecurringTaskListItem({ task, todayLog, due, periodProgress, category, onOpenLogSheet }: Props) {
  const theme = useAppTheme();

  return (
    <Card style={styles.row}>
      <Link href={{ pathname: '/tasks/[id]', params: { id: String(task.id) } }} asChild>
        <Pressable style={styles.linkRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {task.important ? <Ionicons name="star" size={13} color={theme.colors.warning} /> : null}
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              {task.title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 4 }}>
            <PriorityChip priority={task.priority} />
            {category ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name={category.icon as never} size={11} color={category.color} />
                <Text style={{ color: category.color, fontSize: theme.typography.size.xs }}>{category.name}</Text>
              </View>
            ) : (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {task.recurrence_frequency === 'daily'
                  ? 'Every day'
                  : task.recurrence_frequency === 'monthly'
                    ? 'Monthly'
                    : task.recurrence_frequency === 'periodic'
                      ? 'Periodic'
                      : 'Weekly'}
              </Text>
            )}
            {task.recurrence_frequency === 'periodic' && task.period_target_count ? (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {periodProgress ?? 0}/{task.period_target_count}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>
      {due ? (
        <Pressable
          onPress={onOpenLogSheet}
          hitSlop={8}
          style={[
            styles.checkbox,
            {
              borderRadius: theme.radius.full,
              borderColor: todayLog?.status === 'done' ? theme.colors.success : todayLog?.status === 'fail' ? theme.colors.danger : theme.colors.border,
              backgroundColor: todayLog?.status === 'done' ? theme.colors.success : todayLog?.status === 'fail' ? theme.colors.danger : 'transparent',
            },
          ]}>
          <Ionicons
            name={todayLog?.status === 'done' ? 'checkmark' : todayLog?.status === 'fail' ? 'close' : todayLog?.status === 'skip' ? 'remove' : 'ellipse-outline'}
            size={16}
            color={todayLog ? '#fff' : theme.colors.textTertiary}
          />
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkRow: {
    flex: 1,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
