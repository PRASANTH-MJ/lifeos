import {
  filterLogsOnDate,
  formatDurationShort,
  sumDurationForHabitId,
  sumDurationForTaskId,
  sumDurationSeconds,
} from '@/modules/timer/aggregate';
import type { TimerLog } from '@/modules/timer/types';

const log = (overrides: Partial<TimerLog>): TimerLog => ({
  id: 1,
  label: null,
  habit_id: null,
  task_id: null,
  duration_seconds: 0,
  completed_at: new Date(2026, 8, 5, 10, 0, 0).toISOString(),
  note: null,
  ...overrides,
});

/** Local noon on the given day, round-tripped through toISOString() — filterLogsOnDate parses
 * completed_at back with `new Date(...)`, which reads local time on this same machine, so this
 * stays timezone-safe without hardcoding a UTC offset. */
const localTimestamp = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute, 0).toISOString();

describe('sumDurationSeconds', () => {
  test('sums durations across a list of sessions', () => {
    expect(sumDurationSeconds([log({ duration_seconds: 60 }), log({ duration_seconds: 90 })])).toBe(150);
  });

  test('returns 0 for an empty list', () => {
    expect(sumDurationSeconds([])).toBe(0);
  });
});

describe('sumDurationForTaskId', () => {
  test('sums session durations for a given task id, ignoring sessions on other tasks/habits', () => {
    const logs = [
      log({ task_id: 1, duration_seconds: 300 }),
      log({ task_id: 2, duration_seconds: 500 }),
      log({ task_id: 1, duration_seconds: 200 }),
      log({ habit_id: 1, duration_seconds: 999 }),
      log({ duration_seconds: 111 }),
    ];
    expect(sumDurationForTaskId(logs, 1)).toBe(500);
    expect(sumDurationForTaskId(logs, 2)).toBe(500);
    expect(sumDurationForTaskId(logs, 3)).toBe(0);
  });
});

describe('sumDurationForHabitId', () => {
  test('sums session durations for a given habit id, ignoring everything else', () => {
    const logs = [
      log({ habit_id: 7, duration_seconds: 120 }),
      log({ habit_id: 7, duration_seconds: 60 }),
      log({ habit_id: 8, duration_seconds: 1000 }),
      log({ task_id: 7, duration_seconds: 1000 }),
    ];
    expect(sumDurationForHabitId(logs, 7)).toBe(180);
  });
});

describe('filterLogsOnDate', () => {
  test('keeps only sessions completed on the given date key', () => {
    const logs = [
      log({ completed_at: localTimestamp(2026, 9, 5, 8, 0), duration_seconds: 60 }),
      log({ completed_at: localTimestamp(2026, 9, 4, 23, 59), duration_seconds: 90 }),
      log({ completed_at: localTimestamp(2026, 9, 5, 23, 0), duration_seconds: 30 }),
    ];
    const todays = filterLogsOnDate(logs, '2026-09-05');
    expect(todays).toHaveLength(2);
    expect(sumDurationSeconds(todays)).toBe(90);
  });
});

describe('formatDurationShort', () => {
  test('formats sub-hour durations as minutes only', () => {
    expect(formatDurationShort(0)).toBe('0m');
    expect(formatDurationShort(12 * 60)).toBe('12m');
  });

  test('formats hour-plus durations as "Xh Ym"', () => {
    expect(formatDurationShort(3 * 3600 + 20 * 60)).toBe('3h 20m');
  });

  test('omits the minutes segment on an exact hour', () => {
    expect(formatDurationShort(2 * 3600)).toBe('2h');
  });

  test('rounds to the nearest minute', () => {
    expect(formatDurationShort(89)).toBe('1m');
  });
});
