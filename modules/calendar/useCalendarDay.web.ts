import { useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { isDue, parseTargetDays, type Habit } from '@/modules/habits';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import type { Task } from '@/modules/tasks';
import type { CalendarEvent } from './types';

/**
 * Web build of useCalendarDay.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect + manual refresh(): every mounted instance re-renders
 * automatically when calendar_events/tasks/habits/habit_logs change in any tab, or when the sync
 * engine merges remote writes. `refresh` is kept as a no-op for callers that still await it.
 */
export function useCalendarDay(dateKey: string) {
  const data = useLiveQuery(async () => {
    const [eventRows, taskRows, habitRows] = await Promise.all([
      webDb.calendar_events.where('date').equals(dateKey).toArray() as unknown as Promise<CalendarEvent[]>,
      webDb.tasks.toArray() as unknown as Promise<Task[]>,
      webDb.habits.toArray() as unknown as Promise<Habit[]>,
    ]);

    // ORDER BY (start_time IS NULL), start_time ASC — rows with a start_time sort before those
    // without one; among rows that have one, ascending string order.
    const sortedEvents = [...eventRows].sort((a, b) => {
      const aNull = a.start_time == null ? 1 : 0;
      const bNull = b.start_time == null ? 1 : 0;
      if (aNull !== bNull) return aNull - bNull;
      if (a.start_time == null || b.start_time == null) return 0;
      return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0;
    });

    // WHERE due_date = ? AND archived = 0 AND parent_task_id IS NULL ORDER BY priority ASC
    // priority is stored as TEXT ('low'|'medium'|'high'), so SQL's ASC order is plain
    // lexicographic string order ('high' < 'low' < 'medium'), not priority severity.
    const dueTasks = taskRows
      .filter((task) => task.due_date === dateKey && !task.archived && task.parent_task_id == null)
      .sort((a, b) => (a.priority < b.priority ? -1 : a.priority > b.priority ? 1 : 0));

    const activeHabits = habitRows.filter((habit) => !habit.archived);
    const dueHabits = activeHabits.filter((habit) =>
      isDue(dateKey, habit.frequency, parseTargetDays(habit.target_days))
    );

    const dueHabitIds = new Set(dueHabits.map((habit) => habit.id));
    // habit_logs has no standalone 'date' index (only the compound &[habit_id+date]) — filter
    // client-side rather than .where('date'), which would throw a Dexie SchemaError.
    const logRows = dueHabitIds.size
      ? ((await webDb.habit_logs.toArray()) as { date: string; habit_id: number; status: string }[]).filter(
          (log) => log.date === dateKey
        )
      : [];
    const loggedIds = new Set(
      logRows.filter((log) => log.status === 'done' && dueHabitIds.has(log.habit_id)).map((log) => log.habit_id)
    );

    return {
      events: sortedEvents,
      tasksDue: dueTasks,
      habitsDue: dueHabits.map((habit) => ({ habit, completed: loggedIds.has(habit.id) })),
    };
  }, [dateKey]);

  const loading = data === undefined;
  const events = data?.events ?? [];
  const tasksDue = data?.tasksDue ?? [];
  const habitsDue = data?.habitsDue ?? [];

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const createEvent = useCallback(
    async (values: { title: string; notes?: string; startTime?: string | null; endTime?: string | null }) => {
      const now = new Date().toISOString();
      const id = await webDb.calendar_events.add({
        title: values.title,
        notes: values.notes ?? null,
        date: dateKey,
        start_time: values.startTime ?? null,
        end_time: values.endTime ?? null,
        created_at: now,
        sync_id: Crypto.randomUUID(),
        updated_at: now,
      } as never);
      await pushLocalRow('calendar_events', id as number);
    },
    [dateKey]
  );

  const toggleHabit = useCallback(
    async (habitId: number) => {
      const existing = await webDb.habit_logs
        .where('[habit_id+date]')
        .equals([habitId, dateKey])
        .first() as { id: number } | undefined;

      if (existing) {
        await recordDeleteBeforeRemoving('habit_logs', existing.id);
        await webDb.habit_logs.delete(existing.id);
      } else {
        const now = new Date().toISOString();
        const id = await webDb.habit_logs.add({
          habit_id: habitId,
          date: dateKey,
          status: 'done',
          completed_at: now,
          sync_id: Crypto.randomUUID(),
          updated_at: now,
        } as never);
        await pushLocalRow('habit_logs', id as number);
      }
    },
    [dateKey]
  );

  const toggleTask = useCallback(async (task: Task) => {
    const now = new Date().toISOString();
    await webDb.tasks.update(task.id, {
      completed_at: task.completed_at ? null : now,
      updated_at: now,
    });
    await pushLocalRow('tasks', task.id);
  }, []);

  return { events, tasksDue, habitsDue, loading, createEvent, toggleHabit, toggleTask, refresh };
}
