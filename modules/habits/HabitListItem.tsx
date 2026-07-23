import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components';
import type { Category } from '@/modules/categories';
import { useAppTheme } from '@/theme';
import { StreakBadge } from './StreakBadge';
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
};

export function HabitListItem({ habit, streak, periodProgress, todayLog, category, onToggle, onOpenLogSheet }: Props) {
  const theme = useAppTheme();
  const due = isDueToday(habit.frequency, parseTargetDays(habit.target_days));
  const isYesNo = habit.tracking_type === 'yesno';
  const completedToday = todayLog?.status === 'done';

  return (
    <Card style={styles.row}>
      <Link href={{ pathname: '/habits/[id]', params: { id: String(habit.id) } }} asChild>
        <Pressable style={styles.linkRow}>
          <View
            style={[
              styles.icon,
              { backgroundColor: theme.colors.moduleHabitsMuted, borderRadius: theme.radius.md },
            ]}>
            <Ionicons name={habit.icon as never} size={20} color={theme.colors.moduleHabits} />
          </View>
          <View style={styles.info}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.size.base,
                fontWeight: theme.typography.weight.semibold,
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
        ) : (
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
        )
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
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
