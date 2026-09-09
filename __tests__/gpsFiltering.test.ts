import {
  DEFAULT_MAX_SPEED_KMH,
  MAX_ACCURACY_METERS,
  MAX_SPEED_KMH_BY_ACTIVITY,
  isAcceptableAccuracy,
  isRealisticSpeed,
  maxSpeedMpsFor,
  movingAverage,
} from '@/modules/cardio/gpsFiltering';

describe('isAcceptableAccuracy', () => {
  test('accepts a fix at or under the threshold', () => {
    expect(isAcceptableAccuracy(5)).toBe(true);
    expect(isAcceptableAccuracy(MAX_ACCURACY_METERS)).toBe(true);
  });

  test('rejects a fix above the threshold', () => {
    expect(isAcceptableAccuracy(MAX_ACCURACY_METERS + 0.1)).toBe(false);
    expect(isAcceptableAccuracy(150)).toBe(false);
  });

  test('missing accuracy is let through rather than rejected', () => {
    expect(isAcceptableAccuracy(null)).toBe(true);
    expect(isAcceptableAccuracy(undefined)).toBe(true);
  });
});

describe('maxSpeedMpsFor', () => {
  test('uses the default 25 km/h bound for running/walking/hiking', () => {
    expect(maxSpeedMpsFor('running')).toBeCloseTo((DEFAULT_MAX_SPEED_KMH * 1000) / 3600);
    expect(maxSpeedMpsFor('walking')).toBeCloseTo((DEFAULT_MAX_SPEED_KMH * 1000) / 3600);
    expect(maxSpeedMpsFor('hiking')).toBeCloseTo((DEFAULT_MAX_SPEED_KMH * 1000) / 3600);
  });

  test('uses a higher bound for cycling', () => {
    const cyclingKmh = MAX_SPEED_KMH_BY_ACTIVITY.cycling as number;
    expect(cyclingKmh).toBeGreaterThan(DEFAULT_MAX_SPEED_KMH);
    expect(maxSpeedMpsFor('cycling')).toBeCloseTo((cyclingKmh * 1000) / 3600);
  });
});

describe('isRealisticSpeed', () => {
  test('accepts a plausible running speed (12 km/h over 4s)', () => {
    const maxSpeedMps = maxSpeedMpsFor('running');
    const metersOverFourSeconds = (12 * 1000) / 3600 * 4; // ~13.3m
    expect(isRealisticSpeed(metersOverFourSeconds, 4, maxSpeedMps)).toBe(true);
  });

  test('rejects a teleport spike (500m in 4s) for running', () => {
    expect(isRealisticSpeed(500, 4, maxSpeedMpsFor('running'))).toBe(false);
  });

  test('a speed that would be unrealistic for running is realistic for cycling', () => {
    // ~40 km/h over 4s — too fast to trust for a runner, fine for a cyclist.
    const meters = (40 * 1000) / 3600 * 4;
    expect(isRealisticSpeed(meters, 4, maxSpeedMpsFor('running'))).toBe(false);
    expect(isRealisticSpeed(meters, 4, maxSpeedMpsFor('cycling'))).toBe(true);
  });

  test('a non-positive time gap is never realistic', () => {
    expect(isRealisticSpeed(10, 0, 100)).toBe(false);
    expect(isRealisticSpeed(10, -1, 100)).toBe(false);
  });
});

describe('movingAverage', () => {
  test('averages the trailing window only', () => {
    // window of 3 over [10, 20, 30, 100] -> last 3 values [20, 30, 100] -> avg 50
    expect(movingAverage([10, 20, 30, 100], 3)).toBeCloseTo(50);
  });

  test('averages all values when fewer than the window size are available', () => {
    expect(movingAverage([10, 20], 5)).toBeCloseTo(15);
  });

  test('smooths a single noisy spike compared to using the raw last value', () => {
    const altitudes = [100, 101, 100, 99, 130]; // 130 is a noisy spike
    const smoothed = movingAverage(altitudes, 5);
    expect(smoothed).toBeLessThan(130);
    expect(smoothed).toBeCloseTo((100 + 101 + 100 + 99 + 130) / 5);
  });

  test('empty input returns 0', () => {
    expect(movingAverage([], 5)).toBe(0);
  });
});
