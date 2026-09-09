import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, ScreenContainer } from '@/components';
import { webDb } from '@/db/webDb';
import { addDays, formatDisplayDate, todayKey } from '@/lib/date';
import type { CalendarEvent } from '@/modules/calendar';
import type { Task } from '@/modules/tasks';
import { useAppTheme } from '@/theme';

/**
 * Web build of weekly-review.tsx — same read-only three-section layout, but reactive via
 * Dexie's useLiveQuery over webDb instead of expo-sqlite's useSQLiteContext, which web has no
 * provider for (see db/StorageProvider.web.tsx). Filters/sorts mirror the native SQL exactly.
 */
export default function WeeklyReviewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const today = todayKey();
  const weekEnd = addDays(today, 6);

  const data = useLiveQuery(async () => {
    const [taskRows, eventRows] = await Promise.all([
      webDb.tasks.toArray() as unknown as Promise<Task[]>,
      webDb.calendar_events.toArray() as unknown as Promise<CalendarEvent[]>,
    ]);

    const isActiveTopLevelTask = (task: Task) =>
      task.archived === 0 && task.parent_task_id === null && task.is_recurring === 0 && task.due_date !== null && task.completed_at === null;

    const overdue = taskRows
      .filter((task) => isActiveTopLevelTask(task) && task.due_date! < today)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0));

    const upcoming = taskRows
      .filter((task) => isActiveTopLevelTask(task) && task.due_date! >= today && task.due_date! <= weekEnd)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0));

    const events = eventRows
      .filter((event) => event.date >= today && event.date <= weekEnd)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        const aNull = a.start_time == null ? 1 : 0;
        const bNull = b.start_time == null ? 1 : 0;
        if (aNull !== bNull) return aNull - bNull;
        if (a.start_time == null || b.start_time == null) return 0;
        return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0;
      });

    return { overdue, upcoming, events };
  }, [today, weekEnd]);

  if (!data) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const { overdue: overdueTasks, upcoming: upcomingTasks, events: upcomingEvents } = data;
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
