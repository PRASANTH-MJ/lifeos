import { computeWorkoutStreak } from '@/modules/workout/streak';

const TODAY = new Date('2026-08-30T10:00:00');

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(TODAY);
});

afterEach(() => {
  jest.useRealTimers();
});

test('counts a run of consecutive completed days ending today', () => {
  const logs = [{ completed_at: '2026-08-28T09:00:00' }, { completed_at: '2026-08-29T09:00:00' }, { completed_at: '2026-08-30T09:00:00' }];
  expect(computeWorkoutStreak(logs)).toBe(3);
});

test('unlike cardio\'s streak, a missing completion today zeroes it out immediately (no "day isn\'t over yet" grace)', () => {
  const logs = [{ completed_at: '2026-08-28T09:00:00' }, { completed_at: '2026-08-29T09:00:00' }];
  expect(computeWorkoutStreak(logs)).toBe(0);
});

test('multiple completions on the same day only count once', () => {
  const logs = [{ completed_at: '2026-08-30T08:00:00' }, { completed_at: '2026-08-30T20:00:00' }];
  expect(computeWorkoutStreak(logs)).toBe(1);
});

test('no logs at all is a zero streak', () => {
  expect(computeWorkoutStreak([])).toBe(0);
});
