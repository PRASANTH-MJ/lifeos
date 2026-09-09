import { toDateKey } from '@/lib/date';
import type { TimerLog } from './types';

/** Sums `duration_seconds` across a list of timer sessions — the shared building block behind
 * every "time spent" total on this screen. Callers are expected to have already scoped `logs`
 * to the task/habit/date they care about (see sumDurationForTaskId, sumDurationForHabitId,
 * filterLogsOnDate below) — this itself makes no assumptions about what's in the list. */
export function sumDurationSeconds(logs: Pick<TimerLog, 'duration_seconds'>[]): number {
  return logs.reduce((total, log) => total + log.duration_seconds, 0);
}

/** Sums session durations for a given task id, out of a (possibly mixed — other tasks, habits,
 * unlinked sessions) list of timer logs. Used to show "time spent" on a Task detail screen. */
export function sumDurationForTaskId(logs: Pick<TimerLog, 'task_id' | 'duration_seconds'>[], taskId: number): number {
  return sumDurationSeconds(logs.filter((log) => log.task_id === taskId));
}

/** Same as sumDurationForTaskId, but for a Habit detail screen's linked sessions. */
export function sumDurationForHabitId(logs: Pick<TimerLog, 'habit_id' | 'duration_seconds'>[], habitId: number): number {
  return sumDurationSeconds(logs.filter((log) => log.habit_id === habitId));
}

/** Narrows a list of timer logs down to the ones completed on a given date (a `todayKey()`-style
 * "YYYY-MM-DD" key), for the "today" half of a Time Spent card. */
export function filterLogsOnDate(logs: TimerLog[], dateKey: string): TimerLog[] {
  return logs.filter((log) => toDateKey(new Date(log.completed_at)) === dateKey);
}

/** Formats a duration in seconds as a short "3h 20m" / "12m" / "0m" label — the display format
 * used by the Time Spent cards on the Task and Habit detail screens. Rounds to the nearest
 * minute; never shows seconds, since sub-minute precision isn't meaningful at that scale. */
export function formatDurationShort(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
