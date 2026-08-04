import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { glowStrokeLayers, nextGradientId } from './charts/glow';
import { smoothPath } from './charts/smoothPath';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';
import { Legend } from './StatsBits';

type Point = { date: string; value: number };

type Props = {
  /** Rendered as bars, scaled to its own max. */
  barSeries: Point[];
  /** Rendered as an overlaid line, scaled to its own max — a different unit than the bars is
   * fine (e.g. task count vs. a 1–5 mood score), since each is normalized independently. */
  lineSeries: Point[];
  barColor: string;
  lineColor: string;
  barLabel: string;
  lineLabel: string;
  height?: number;
};

/** A correlative view — one series as bars, another as an overlaid line, sharing one date axis
 * so a relationship between the two (e.g. "mood tends to rise on days with more tasks done") is
 * visible at a glance. Both series are independently normalized to the chart's full height, so
 * this shows shape/timing correlation, not absolute magnitude comparison. */
export function OverlayChart({ barSeries, lineSeries, barColor, lineColor, barLabel, lineLabel, height = 120 }: Props) {
  const theme = useAppTheme();
  const [gradientId] = useState(() => nextGradientId('overlay-bar'));
  const n = barSeries.length;
  const barMax = Math.max(...barSeries.map((p) => p.value), 1);
  const lineMax = Math.max(...lineSeries.map((p) => p.value), 1);
  const width = Math.max(n - 1, 1) * 24 + 16;
  const barWidth = Math.min(14, ((width - 16) / Math.max(n, 1)) * 0.6);

  const xFor = (index: number) => (n > 1 ? (index / (n - 1)) * (width - 16) + 8 : width / 2);

  const lineCoords = lineSeries.map((point, index) => ({
    x: xFor(index),
    y: height - (point.value / lineMax) * (height - 12) - 6,
  }));
  const linePath = smoothPath(lineCoords);
  const glowLayers = glowStrokeLayers(2.5);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ height, width: '100%' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={barColor} stopOpacity={0.65} />
              <Stop offset="1" stopColor={withAlpha(barColor, 0.25)} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          {barSeries.map((point, index) => {
            const barHeight = Math.max((point.value / barMax) * (height - 6), point.value > 0 ? 3 : 0);
            return (
              <Rect
                key={point.date}
                x={xFor(index) - barWidth / 2}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 2}
                fill={`url(#${gradientId})`}
              />
            );
          })}
          {glowLayers.map((layer, index) => (
            <Path
              key={index}
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth={layer.strokeWidth}
              strokeOpacity={layer.opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {lineCoords.map((c, index) => (
            <Circle key={index} cx={c.x} cy={c.y} r={3} fill={lineColor} />
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, justifyContent: 'center' }}>
        <Legend color={barColor} label={barLabel} />
        <Legend color={lineColor} label={lineLabel} />
      </View>
    </View>
  );
}
