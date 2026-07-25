import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { isDue, parseTargetDays, type Habit } from '@/modules/habits';
import type { Task } from '@/modules/tasks';
import type { CalendarEvent } from './types';

export function useCalendarDay(dateKey: string) {
  const db = useSQLiteContext();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasksDue, setTasksDue] = useState<Task[]>([]);
  const [habitsDue, setHabitsDue] = useState<{ habit: Habit; completed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [eventRows, taskRows, habitRows] = await Promise.all([
      db.getAllAsync<CalendarEvent>(
        'SELECT * FROM calendar_events WHERE date = ? ORDER BY (start_time IS NULL), start_time ASC',
        [dateKey]
      ),
      db.getAllAsync<Task>(
        'SELECT * FROM tasks WHERE due_date = ? AND archived = 0 AND parent_task_id IS NULL ORDER BY priority ASC',
        [dateKey]
      ),
      db.getAllAsync<Habit>('SELECT * FROM habits WHERE archived = 0', []),
    ]);

    const dueHabits = habitRows.filter((habit) => isDue(dateKey, habit.frequency, parseTargetDays(habit.target_days)));

    const logRows = dueHabits.length
      ? await db.getAllAsync<{ habit_id: number }>(
          `SELECT habit_id FROM habit_logs WHERE date = ? AND status = 'done' AND habit_id IN (${dueHabits.map(() => '?').join(', ')})`,
          [dateKey, ...dueHabits.map((habit) => habit.id)]
        )
      : [];
    const loggedIds = new Set(logRows.map((row) => row.habit_id));

    setEvents(eventRows);
    setTasksDue(taskRows);
    setHabitsDue(dueHabits.map((habit) => ({ habit, completed: loggedIds.has(habit.id) })));
    setLoading(false);
  }, [db, dateKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const createEvent = useCallback(
    async (values: { title: string; notes?: string; startTime?: string | null; endTime?: string | null }) => {
      await db.runAsync(
        'INSERT INTO calendar_events (title, notes, date, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [values.title, values.notes ?? null, dateKey, values.startTime ?? null, values.endTime ?? null, new Date().toISOString()]
      );
      await refresh();
    },
    [db, dateKey, refresh]
  );

  const toggleHabit = useCallback(
    async (habitId: number) => {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?',
        [habitId, dateKey]
      );
      if (existing) {
        await db.runAsync('DELETE FROM habit_logs WHERE id = ?', [existing.id]);
      } else {
        await db.runAsync("INSERT INTO habit_logs (habit_id, date, status, completed_at) VALUES (?, ?, 'done', ?)", [
          habitId,
          dateKey,
          new Date().toISOString(),
        ]);
      }
      await refresh();
    },
    [db, dateKey, refresh]
  );

  const toggleTask = useCallback(
    async (task: Task) => {
      await db.runAsync('UPDATE tasks SET completed_at = ? WHERE id = ?', [
        task.completed_at ? null : new Date().toISOString(),
        task.id,
      ]);
      await refresh();
    },
    [db, refresh]
  );

  return { events, tasksDue, habitsDue, loading, createEvent, toggleHabit, toggleTask, refresh };
}
