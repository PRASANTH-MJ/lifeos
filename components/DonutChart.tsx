import { Text, View } from 'react-native';
import { Circle, Svg } from 'react-native-svg';

import { useAppTheme } from '@/theme';

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
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  let cumulative = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.border} strokeWidth={strokeWidth} fill="none" />
        {total > 0
          ? segments.map((segment, index) => {
              if (segment.value <= 0) return null;
              const length = (segment.value / total) * circumference;
              const dashOffset = -cumulative;
              cumulative += length;
              return (
                <Circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                />
              );
            })
          : null}
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
