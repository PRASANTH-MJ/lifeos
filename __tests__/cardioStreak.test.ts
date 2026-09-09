import { computeCardioStreak } from '@/modules/cardio/streak';

const TODAY = new Date('2026-08-30T10:00:00');

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(TODAY);
});

afterEach(() => {
  jest.useRealTimers();
});

test('counts a run of consecutive days ending today', () => {
  const logs = [{ date: '2026-08-28' }, { date: '2026-08-29' }, { date: '2026-08-30' }];
  expect(computeCardioStreak(logs)).toBe(3);
});

test('still counts the streak if today has no log yet, as long as yesterday does', () => {
  const logs = [{ date: '2026-08-28' }, { date: '2026-08-29' }];
  expect(computeCardioStreak(logs)).toBe(2);
});

test('zeroes out once neither today nor yesterday is logged', () => {
  const logs = [{ date: '2026-08-27' }, { date: '2026-08-26' }];
  expect(computeCardioStreak(logs)).toBe(0);
});

test('a gap in the middle stops the count from reaching further back', () => {
  const logs = [{ date: '2026-08-30' }, { date: '2026-08-28' }, { date: '2026-08-27' }];
  expect(computeCardioStreak(logs)).toBe(1);
});

test('no logs at all is a zero streak', () => {
  expect(computeCardioStreak([])).toBe(0);
});
