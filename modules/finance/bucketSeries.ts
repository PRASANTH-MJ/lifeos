function formatShortMonthDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Downsamples a dense daily {date, value} series to at most `maxPoints` buckets — 'sum' for
 * additive quantities (spend, income), 'last' for point-in-time snapshots (a running balance). */
export function bucketValueSeries(
  points: { date: string; value: number }[],
  maxPoints: number,
  mode: 'sum' | 'last'
): { label: string; value: number }[] {
  const chunkSize = Math.max(Math.ceil(points.length / maxPoints), 1);
  const buckets: { label: string; value: number }[] = [];
  for (let i = 0; i < points.length; i += chunkSize) {
    const chunk = points.slice(i, i + chunkSize);
    const value = mode === 'sum' ? chunk.reduce((sum, p) => sum + p.value, 0) : chunk[chunk.length - 1].value;
    buckets.push({ label: formatShortMonthDay(chunk[chunk.length - 1].date), value });
  }
  return buckets;
}

/** Same downsampling as `bucketValueSeries`, for a series carrying several additive fields at once
 * (e.g. income+expense, or must/need/want) — every named field is summed per bucket. `date` is
 * kept out of the generic `values` record (rather than flattened alongside it) so a generic key
 * of `K` can never be mistaken for the `date` field by the type checker. */
export function bucketRecordSeries<K extends string>(
  points: { date: string; values: Record<K, number> }[],
  keys: K[],
  maxPoints: number
): (Record<K, number> & { label: string })[] {
  const chunkSize = Math.max(Math.ceil(points.length / maxPoints), 1);
  const buckets: (Record<K, number> & { label: string })[] = [];
  for (let i = 0; i < points.length; i += chunkSize) {
    const chunk = points.slice(i, i + chunkSize);
    const sums = {} as Record<K, number>;
    for (const key of keys) {
      sums[key] = chunk.reduce((sum: number, p) => sum + p.values[key], 0);
    }
    buckets.push({ ...sums, label: formatShortMonthDay(chunk[chunk.length - 1].date) });
  }
  return buckets;
}
