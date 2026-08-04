type Point = { x: number; y: number };

/**
 * Builds a smooth SVG path `d` string through a series of points, using a cardinal (Catmull-Rom
 * style) spline converted to cubic Bezier segments — the standard way to turn a straight-segment
 * Polyline into a curved line without overshooting past the actual data points. Tension is fixed
 * at the common 1/6 factor, which reads as a gentle, natural curve rather than an exaggerated one.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

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
