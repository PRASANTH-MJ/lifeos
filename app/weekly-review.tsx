import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { Card, EmptyState, IconBadge, LoadingState, ScreenContainer } from '@/components';
import { addDays, formatDisplayDate, todayKey } from '@/lib/date';
import type { CalendarEvent } from '@/modules/calendar';
import type { Task } from '@/modules/tasks';
import { useAppTheme } from '@/theme';

/**
 * Read-only consolidated planning view deep-linked from the Sunday "Weekly Review" local
 * notification (see app/_layout.tsx's useScheduleWeeklyReviewReminder) and also reachable anytime
 * from the Today hub / Settings — three simple sections (overdue, due this week, upcoming events),
 * each row tapping straight through to the real screen for that item. No "replanning" flow here,
 * on purpose — the actual editing already lives on the task/event detail screens this just links to.
 */
export default function WeeklyReviewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const today = todayKey();
      const weekEnd = addDays(today, 6);
      const [overdueRows, upcomingRows, eventRows] = await Promise.all([
        db.getAllAsync<Task>(
          'SELECT * FROM tasks WHERE archived = 0 AND parent_task_id IS NULL AND is_recurring = 0 AND due_date IS NOT NULL AND due_date < ? AND completed_at IS NULL ORDER BY due_date ASC',
          [today]
        ),
        db.getAllAsync<Task>(
          'SELECT * FROM tasks WHERE archived = 0 AND parent_task_id IS NULL AND is_recurring = 0 AND due_date IS NOT NULL AND due_date BETWEEN ? AND ? AND completed_at IS NULL ORDER BY due_date ASC',
          [today, weekEnd]
        ),
        db.getAllAsync<CalendarEvent>(
          'SELECT * FROM calendar_events WHERE date BETWEEN ? AND ? ORDER BY date ASC, (start_time IS NULL), start_time ASC',
          [today, weekEnd]
        ),
      ]);
      setOverdueTasks(overdueRows);
      setUpcomingTasks(upcomingRows);
      setUpcomingEvents(eventRows);
      setLoading(false);
    })();
  }, [db]);

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const nothingAtAll = overdueTasks.length === 0 && upcomingTasks.length === 0 && upcomingEvents.length === 0;

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          A quick planning check-in — what's overdue, what's due this week, and what's on your calendar.
        </Text>

        {nothingAtAll ? (
          <EmptyState icon="checkmark-done-circle-outline" title="All clear" subtitle="Nothing overdue, nothing due this week, and no events coming up." />
        ) : (
          <>
            <ReviewSection
              title="Overdue"
              icon="alert-circle"
              color={theme.colors.danger}
              emptyLabel="Nothing overdue."
              items={overdueTasks.map((task) => ({
                key: `task-${task.id}`,
                label: task.title,
                detail: `Was due ${formatDisplayDate(task.due_date!)}`,
                onPress: () => router.push({ pathname: '/tasks/[id]', params: { id: String(task.id) } }),
              }))}
            />

            <ReviewSection
              title="Due this week"
              icon="calendar-outline"
              color={theme.colors.moduleTasks}
              emptyLabel="Nothing due this week."
              items={upcomingTasks.map((task) => ({
                key: `task-${task.id}`,
                label: task.title,
                detail: `Due ${formatDisplayDate(task.due_date!)}`,
                onPress: () => router.push({ pathname: '/tasks/[id]', params: { id: String(task.id) } }),
              }))}
            />

            <ReviewSection
              title="Upcoming events"
              icon="today-outline"
              color={theme.colors.primary}
              emptyLabel="No events in the next 7 days."
              items={upcomingEvents.map((event) => ({
                key: `event-${event.id}`,
                label: event.title,
                detail: formatDisplayDate(event.date),
                onPress: () => router.push({ pathname: '/calendar/[id]', params: { id: String(event.id) } }),
              }))}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function ReviewSection({
  title,
  icon,
  color,
  emptyLabel,
  items,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  emptyLabel: string;
  items: { key: string; label: string; detail: string; onPress: () => void }[];
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          {title}
        </Text>
        {items.length > 0 ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>({items.length})</Text>
        ) : null}
      </View>
      {items.length === 0 ? (
        <Card>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{emptyLabel}</Text>
        </Card>
      ) : (
        <Card tier="panel" style={{ gap: theme.spacing.sm }}>
          {items.map((item) => (
            <Pressable key={item.key} onPress={item.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name={icon} color={color} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{item.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
            </Pressable>
          ))}
        </Card>
      )}
    </View>
  );
}
