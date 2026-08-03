import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

type Point = { date: string; value: number };

type Props = {
  data: Point[];
  color: string;
  height?: number;
  width?: number;
};

/** A bare inline trend line — no label, no axes, no dots — for compact "metric + sparkline +
 * delta" rows (see modules/analytics/useCheckinTrends.ts). Normalizes to the data's own
 * min/max (unlike LineChart, which anchors to zero) since these are small-range 1-5 scale
 * values where zero-anchoring would flatten the line to near-nothing. */
export function Sparkline({ data, color, height = 32, width = 80 }: Props) {
  if (data.length === 0) return <View style={{ height, width }} />;

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = data.map((point, index) => {
    const x = data.length > 1 ? (index / (data.length - 1)) * (width - 4) + 2 : width / 2;
    const y = height - ((point.value - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });

  return (
    <View style={{ height, width }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
