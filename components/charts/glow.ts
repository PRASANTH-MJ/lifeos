/**
 * SVG `<filter>`/`feGaussianBlur` renders unreliably on Android — the cross-platform substitute
 * used by every glowing chart line in this app is layering a few extra strokes of the same color
 * at increasing width and decreasing opacity behind the real, crisp line on top.
 */
export type GlowLayer = { strokeWidth: number; opacity: number };

export function glowStrokeLayers(baseStrokeWidth: number): GlowLayer[] {
  return [
    { strokeWidth: baseStrokeWidth + 9, opacity: 0.05 },
    { strokeWidth: baseStrokeWidth + 5, opacity: 0.1 },
    { strokeWidth: baseStrokeWidth + 2, opacity: 0.18 },
  ];
}

/** A smaller-scale variant for compact elements (e.g. Sparkline) where the full-size glow would
 * overwhelm the chart's own footprint. */
export function subtleGlowStrokeLayers(baseStrokeWidth: number): GlowLayer[] {
  return [{ strokeWidth: baseStrokeWidth + 3, opacity: 0.16 }];
}

/** Stable id so each chart instance's SVG gradient doesn't collide with another chart's on the
 * same screen — react-native-svg gradients are referenced by id string, not by React identity. */
let gradientCounter = 0;
export function nextGradientId(prefix: string): string {
  gradientCounter += 1;
  return `${prefix}-${gradientCounter}`;
}
