import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, CompletionPulse, IconBadge, RowActionsMenu, StreakBadge } from '@/components';
import type { Category } from '@/modules/categories';
import { useAppTheme } from '@/theme';
import { isDueToday } from './streak';
import { parseTargetDays, type Habit, type HabitLog } from './types';

type Props = {
  habit: Habit;
  streak: number;
  periodProgress: number | null;
  todayLog?: HabitLog;
  category?: Category;
  onToggle: () => void;
  onOpenLogSheet: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
};

export function HabitListItem({
  habit,
  streak,
  periodProgress,
  todayLog,
  category,
  onToggle,
  onOpenLogSheet,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onArchive,
  onDelete,
}: Props) {
  const theme = useAppTheme();
  const due = isDueToday(habit.frequency, parseTargetDays(habit.target_days));
  const isYesNo = habit.tracking_type === 'yesno';
  const completedToday = todayLog?.status === 'done';

  return (
    <Card style={[styles.row, completedToday ? { opacity: 0.7 } : null]}>
      <Link href={{ pathname: '/habits/[id]', params: { id: String(habit.id) } }} asChild>
        <Pressable style={styles.linkRow}>
          <IconBadge name={habit.icon as never} color={theme.colors.moduleHabits} size="md" />
          <View style={styles.info}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.size.base,
                fontWeight: theme.typography.weight.semibold,
                textDecorationLine: completedToday ? 'line-through' : 'none',
              }}
              numberOfLines={1}>
              {habit.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 2 }}>
              {category ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name={category.icon as never} size={11} color={category.color} />
                  <Text style={{ color: category.color, fontSize: theme.typography.size.xs }}>{category.name}</Text>
                </View>
              ) : (
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  {habit.frequency === 'daily' ? 'Daily' : habit.frequency === 'periodic' ? 'Periodic' : habit.frequency === 'monthly' ? 'Monthly' : 'Weekly'}
                </Text>
              )}
              {habit.frequency === 'periodic' && habit.period_target_count ? (
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  {periodProgress ?? 0}/{habit.period_target_count}
                </Text>
              ) : (
                <StreakBadge streak={streak} />
              )}
            </View>
          </View>
        </Pressable>
      </Link>
      {due ? (
        isYesNo ? (
          <CompletionPulse active={completedToday} size={30}>
            <Pressable
              onPress={onToggle}
              hitSlop={8}
              style={[
                styles.checkbox,
                {
                  borderRadius: theme.radius.full,
                  borderColor: completedToday ? theme.colors.success : theme.colors.border,
                  backgroundColor: completedToday ? theme.colors.success : 'transparent',
                },
              ]}>
              {completedToday ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
            </Pressable>
          </CompletionPulse>
        ) : (
          <CompletionPulse active={todayLog?.status === 'done'} size={30}>
            <Pressable
              onPress={onOpenLogSheet}
              hitSlop={8}
              style={[
                styles.checkbox,
                {
                  borderRadius: theme.radius.full,
                  borderColor:
                    todayLog?.status === 'done' ? theme.colors.success : todayLog?.status === 'fail' ? theme.colors.danger : theme.colors.border,
                  backgroundColor:
                    todayLog?.status === 'done' ? theme.colors.success : todayLog?.status === 'fail' ? theme.colors.danger : 'transparent',
                },
              ]}>
              <Ionicons
                name={todayLog?.status === 'done' ? 'checkmark' : todayLog?.status === 'fail' ? 'close' : todayLog?.status === 'skip' ? 'remove' : 'ellipse-outline'}
                size={16}
                color={todayLog ? '#fff' : theme.colors.textTertiary}
              />
            </Pressable>
          </CompletionPulse>
        )
      ) : null}
      {onDelete ? (
        <RowActionsMenu
          itemLabel={habit.name}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onArchive={onArchive}
          onDelete={onDelete}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
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
