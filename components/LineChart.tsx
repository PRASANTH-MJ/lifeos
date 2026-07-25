import { Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useAppTheme } from '@/theme';

type Point = { date: string; value: number };

type Props = {
  label: string;
  data: Point[];
  color: string;
  formatValue?: (value: number) => string;
  height?: number;
};

/** A connected-line alternative to <TrendChart /> — same data shape, for series where the trend line itself is the point (e.g. mood). */
export function LineChart({ label, data, color, formatValue = (v) => String(Math.round(v)), height = 100 }: Props) {
  const theme = useAppTheme();
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const average = data.length > 0 ? data.reduce((sum, point) => sum + point.value, 0) / data.length : 0;
  const width = Math.max(data.length - 1, 1) * 24 + 16;

  const coords = data.map((point, index) => {
    const x = data.length > 1 ? (index / (data.length - 1)) * (width - 16) + 8 : width / 2;
    const y = height - (point.value / maxValue) * (height - 12) - 6;
    return { x, y };
  });
  const points = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
          {label}
        </Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>avg {formatValue(average)}</Text>
      </View>
      <View style={{ height, width: '100%' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {coords.map((c, index) => (
            <Circle key={index} cx={c.x} cy={c.y} r={3} fill={color} />
          ))}
        </Svg>
      </View>
    </View>
  );
}
