type Point = { x: number; y: number };

/**
 * Builds a smooth SVG path `d` string through a series of points, using a monotone cubic Hermite
 * spline (Fritsch-Carlson tangent limiting) converted to cubic Bezier segments. Unlike a plain
 * cardinal/Catmull-Rom spline, tangents are clamped so the curve never overshoots past a data
 * point at a local peak or dip — it stays smooth without introducing humps that aren't in the data.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push((points[i + 1].y - points[i].y) / dx[i]);
  }

  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (slope[i - 1] === 0 || slope[i] === 0 || (slope[i - 1] < 0) !== (slope[i] < 0)) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * slope[i];
      m[i + 1] = tau * b * slope[i];
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cp1x = p1.x + dx[i] / 3;
    const cp1y = p1.y + (m[i] * dx[i]) / 3;
    const cp2x = p2.x - dx[i] / 3;
    const cp2y = p2.y - (m[i + 1] * dx[i]) / 3;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Same smooth top edge as smoothPath, closed down to a flat baseline — for area-fill charts
 * where only the data-facing edge needs to curve; the baseline edge is always a straight line. */
export function smoothAreaPath(points: Point[], baselineY: number, width: number): string {
  if (points.length === 0) return '';
  return `${smoothPath(points)} L ${width} ${baselineY} L 0 ${baselineY} Z`;
}
