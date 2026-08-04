import { useState } from 'react';
import { Text, View } from 'react-native';
import { Circle, Defs, LinearGradient, Stop, Svg } from 'react-native-svg';

import { nextGradientId } from './charts/glow';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

type Segment = { value: number; color: string };

type Props = {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
};

export function DonutChart({ segments, size = 140, strokeWidth = 16, centerLabel, centerSubLabel }: Props) {
  const theme = useAppTheme();
  const [gradientPrefix] = useState(() => nextGradientId('donut'));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  const arcs: { segment: Segment; length: number; dashOffset: number }[] = [];
  let cumulative = 0;
  if (total > 0) {
    for (const segment of segments) {
      if (segment.value <= 0) continue;
      const length = (segment.value / total) * circumference;
      arcs.push({ segment, length, dashOffset: -cumulative });
      cumulative += length;
    }
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          {arcs.map(({ segment }, index) => (
            <LinearGradient key={index} id={`${gradientPrefix}-${index}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={segment.color} stopOpacity={1} />
              <Stop offset="1" stopColor={withAlpha(segment.color, 0.65)} stopOpacity={1} />
            </LinearGradient>
          ))}
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.border} strokeWidth={strokeWidth} fill="none" />
        {arcs.map(({ segment, length, dashOffset }, index) => (
          <Circle
            key={`glow-${index}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={segment.color}
            strokeWidth={strokeWidth + 8}
            strokeOpacity={0.14}
            fill="none"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
          />
        ))}
        {arcs.map(({ length, dashOffset }, index) => (
          <Circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${gradientPrefix}-${index})`}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
          />
        ))}
      </Svg>
      {centerLabel || centerSubLabel ? (
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          {centerLabel ? (
            <Text style={{ fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold, color: theme.colors.textPrimary }}>
              {centerLabel}
            </Text>
          ) : null}
          {centerSubLabel ? (
            <Text style={{ fontSize: theme.typography.size.xs, color: theme.colors.textTertiary }}>{centerSubLabel}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
