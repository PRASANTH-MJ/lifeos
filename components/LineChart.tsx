import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { glowStrokeLayers, nextGradientId } from './charts/glow';
import { smoothAreaPath, smoothPath } from './charts/smoothPath';
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
  const [gradientId] = useState(() => nextGradientId('line-fill'));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const average = data.length > 0 ? data.reduce((sum, point) => sum + point.value, 0) / data.length : 0;
  const width = Math.max(data.length - 1, 1) * 24 + 16;

  const coords = data.map((point, index) => {
    const x = data.length > 1 ? (index / (data.length - 1)) * (width - 16) + 8 : width / 2;
    const y = height - (point.value / maxValue) * (height - 12) - 6;
    return { x, y };
  });
  const linePath = smoothPath(coords);
  const areaPath = smoothAreaPath(coords, height, width);
  const glowLayers = glowStrokeLayers(2.5);
  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
          {label}
        </Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
          {selected ? `${selected.date} · ${formatValue(selected.value)}` : `avg ${formatValue(average)}`}
        </Text>
      </View>
      <View style={{ height, width: '100%', position: 'relative' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill={`url(#${gradientId})`} />
          {glowLayers.map((layer, index) => (
            <Path
              key={index}
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={layer.strokeWidth}
              strokeOpacity={layer.opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {coords.map((c, index) => (
            <Circle
              key={index}
              cx={c.x}
              cy={c.y}
              r={selectedIndex === index ? 5 : 3}
              fill={selectedIndex === index ? theme.colors.textPrimary : color}
              stroke={selectedIndex === index ? color : 'none'}
              strokeWidth={selectedIndex === index ? 2 : 0}
            />
          ))}
        </Svg>
        {/* Hit targets are plain RN Pressables positioned by percentage (not SVG onPress) — SVG
            touch-responder props leak through as invalid DOM attributes on react-native-web. Since
            the Svg above stretches to 100% width via preserveAspectRatio="none", a viewBox-space
            coordinate maps directly to the same percentage position in the wrapping View. */}
        {coords.map((c, index) => (
          <Pressable
            key={index}
            onPress={() => setSelectedIndex(selectedIndex === index ? null : index)}
            style={{
              position: 'absolute',
              left: `${(c.x / width) * 100}%`,
              top: `${(c.y / height) * 100}%`,
              width: 24,
              height: 24,
              marginLeft: -12,
              marginTop: -12,
            }}
          />
        ))}
      </View>
    </View>
  );
}
