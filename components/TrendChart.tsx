import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlowSurface } from './GlowSurface';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

type Point = { date: string; value: number };

type Props = {
  label: string;
  data: Point[];
  color: string;
  formatValue?: (value: number) => string;
  height?: number;
};

export function TrendChart({ label, data, color, formatValue = (v) => String(Math.round(v)), height = 56 }: Props) {
  const theme = useAppTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const average = data.length > 0 ? data.reduce((sum, point) => sum + point.value, 0) / data.length : 0;
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height }}>
        {data.map((point, index) => {
          const barHeight = Math.max((point.value / maxValue) * height, point.value > 0 ? 3 : 1);
          const bar = (
            <View
              style={{
                width: '100%',
                height: barHeight,
                borderRadius: theme.radius.full,
                overflow: 'hidden',
                backgroundColor: point.value > 0 ? undefined : theme.colors.border,
              }}>
              {point.value > 0 && (
                <LinearGradient colors={[color, withAlpha(color, 0.55)]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }} />
              )}
            </View>
          );
          return (
            <Pressable
              key={point.date}
              onPress={() => setSelectedIndex(selectedIndex === index ? null : index)}
              style={{ flex: 1, height, justifyContent: 'flex-end' }}>
              {point.value > 0 ? (
                <GlowSurface color={color} intensity="sm" borderRadius={theme.radius.full}>
                  {bar}
                </GlowSurface>
              ) : (
                bar
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
