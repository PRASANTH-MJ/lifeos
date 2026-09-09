import { addDays, buildDailySeries, buildMonthGrid, toDateKey, todayKey, weekdayOf } from '@/lib/date';

describe('toDateKey / todayKey', () => {
  test('formats as local YYYY-MM-DD, zero-padded', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 10, 30))).toBe('2026-11-30');
  });

  test('todayKey tracks the system clock', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 30, 23, 59));
    expect(todayKey()).toBe('2026-08-30');
    jest.useRealTimers();
  });
});

describe('addDays', () => {
  test('adds within a month', () => {
    expect(addDays('2026-08-10', 5)).toBe('2026-08-15');
  });

  test('rolls over a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });

  test('rolls over a year boundary', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  test('subtracts (negative amount) and rolls backward over a month boundary', () => {
    expect(addDays('2026-09-01', -2)).toBe('2026-08-30');
  });

  test('correctly steps over a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });
});

describe('weekdayOf', () => {
  test('matches JS Date.getDay() convention (0=Sunday)', () => {
    // 2026-08-30 is a Sunday.
    expect(weekdayOf('2026-08-30')).toBe(0);
    expect(weekdayOf('2026-08-31')).toBe(1);
  });
});

describe('buildDailySeries', () => {
  test('is dense (fills gaps with 0) and ends on today', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 30));
    const series = buildDailySeries(3, { '2026-08-30': 5 });
    jest.useRealTimers();
    expect(series).toEqual([
      { date: '2026-08-28', value: 0 },
      { date: '2026-08-29', value: 0 },
      { date: '2026-08-30', value: 5 },
    ]);
  });
});

describe('buildMonthGrid', () => {
  test('produces a multiple-of-7 grid covering the full month', () => {
    const grid = buildMonthGrid(2026, 7); // August 2026 (0-indexed month)
    expect(grid.length % 7).toBe(0);
    expect(grid).toContain('2026-08-01');
    expect(grid).toContain('2026-08-31');
  });

  test('grid cells are contiguous consecutive days', () => {
    const grid = buildMonthGrid(2026, 7);
    for (let i = 1; i < grid.length; i += 1) {
      expect(addDays(grid[i - 1], 1)).toBe(grid[i]);
    }
  });
});
