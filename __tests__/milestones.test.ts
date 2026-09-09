import { ACTIVITY_MILESTONE_TIERS, formatElapsed, formatPace, formatSpeedKmh } from '@/modules/cardio/milestones';

describe('formatElapsed', () => {
  test('formats under an hour as MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(65)).toBe('01:05');
    expect(formatElapsed(3599)).toBe('59:59');
  });

  test('adds a zero-padded hour segment once an hour in', () => {
    expect(formatElapsed(3600)).toBe('01:00:00');
    expect(formatElapsed(3661)).toBe('01:01:01');
  });
});

describe('formatPace', () => {
  test('computes minutes-per-km pace', () => {
    // 5km in 25 minutes (1500s) = 5:00/km
    expect(formatPace(5, 1500)).toBe('05:00/km');
  });

  test('returns the placeholder dash before there is any distance or time', () => {
    expect(formatPace(0, 600)).toBe('—');
    expect(formatPace(5, 0)).toBe('—');
  });
});

describe('formatSpeedKmh', () => {
  test('computes average speed to one decimal place', () => {
    // 10km in 1 hour (3600s) = 10.0 km/h
    expect(formatSpeedKmh(10, 3600)).toBe('10.0');
  });

  test('returns the placeholder dash before there is any distance or time', () => {
    expect(formatSpeedKmh(0, 3600)).toBe('—');
    expect(formatSpeedKmh(10, 0)).toBe('—');
  });
});

describe('ACTIVITY_MILESTONE_TIERS', () => {
  test('every tier count is unique and sorted ascending', () => {
    const counts = ACTIVITY_MILESTONE_TIERS.map((t) => t.count);
    expect(new Set(counts).size).toBe(counts.length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
  });

  test('ordinal suffixes are correct for the 1st/3rd/5th/10th/100th milestones', () => {
    const label = (count: number) => ACTIVITY_MILESTONE_TIERS.find((t) => t.count === count)?.label;
    expect(label(1)).toBe('1st Activity');
    expect(label(3)).toBe('3rd Activity');
    expect(label(5)).toBe('5th Activity');
    expect(label(10)).toBe('10th Activity');
    expect(label(100)).toBe('100th Activity');
  });
});
