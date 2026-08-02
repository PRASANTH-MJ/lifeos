export type Series = { date: string; value: number }[];

/** Trailing moving average over `windowSize` points (7-day/30-day smoothing for noisy daily
 * series like mood, calories, or spend) — computed in plain JS over an already-fetched series
 * rather than a SQLite window function, since the series is already dense/small by the time it
 * gets here and this keeps the query side of AnalyticsService simple. */
export function movingAverage(series: Series, windowSize: number): Series {
  return series.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = series.slice(start, index + 1);
    const avg = window.reduce((sum, p) => sum + p.value, 0) / window.length;
    return { date: point.date, value: avg };
  });
}

export function sum(series: Series): number {
  return series.reduce((total, point) => total + point.value, 0);
}

export function average(series: Series): number {
  return series.length ? sum(series) / series.length : 0;
}

/** Percent change of `current` vs `previous` for a MetricGrid trend arrow. Returns null when a
 * meaningful percentage can't be computed (previous was zero and current isn't) rather than
 * showing a nonsensical "+Infinity%". */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Pearson correlation coefficient between two same-length, date-aligned series — e.g. daily
 * tasks-completed vs. daily mood score, to describe in plain language whether one tends to move
 * with the other. Returns 0 (no relationship) if either series has zero variance.
 */
export function correlationCoefficient(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : numerator / denom;
}

/** Aligns two series that share the same dense date range (as produced by `buildDailySeries`)
 * into parallel value arrays, ready for `correlationCoefficient` or an overlay chart. */
export function alignSeries(a: Series, b: Series): { dates: string[]; a: number[]; b: number[] } {
  const bByDate = new Map(b.map((point) => [point.date, point.value]));
  const dates = a.map((point) => point.date);
  const aValues = a.map((point) => point.value);
  const bValues = a.map((point) => bByDate.get(point.date) ?? 0);
  return { dates, a: aValues, b: bValues };
}
