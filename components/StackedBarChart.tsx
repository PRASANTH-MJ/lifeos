import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlowSurface } from './GlowSurface';
import { Legend } from './StatsBits';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

type Bucket = { label: string; must: number; need: number; want: number };

type Props = {
  data: Bucket[];
  colors: { must: string; need: string; want: string };
  height?: number;
};

/** One stacked bar per time bucket (must/need/want segments) — the "nature of spending" view,
 * showing both the total and its priority mix per period at a glance. */
export function StackedBarChart({ data, colors, height = 120 }: Props) {
  const theme = useAppTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const totals = data.map((bucket) => bucket.must + bucket.need + bucket.want);
  const maxValue = Math.max(...totals, 1);
  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  const segment = (color: string, share: number) => (
    <View style={{ height: `${share * 100}%` }}>
      <LinearGradient colors={[color, withAlpha(color, 0.6)]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }} />
    </View>
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {selected ? (
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
          {selected.label} · must {Math.round(selected.must)} · need {Math.round(selected.need)} · want {Math.round(selected.want)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm, height }}>
        {data.map((bucket, index) => {
          const total = totals[index];
          const barHeight = Math.max((total / maxValue) * height, total > 0 ? 3 : 1);
          return (
            <Pressable
              key={bucket.label}
              onPress={() => setSelectedIndex(selectedIndex === index ? null : index)}
              style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ height, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                {total > 0 ? (
                  <GlowSurface color={theme.colors.primary} intensity="sm" borderRadius={theme.radius.sm} style={{ width: '70%' }}>
                    <View style={{ width: '100%', height: barHeight, borderRadius: theme.radius.sm, overflow: 'hidden', flexDirection: 'column-reverse' }}>
                      {segment(colors.must, bucket.must / total)}
                      {segment(colors.need, bucket.need / total)}
                      {segment(colors.want, bucket.want / total)}
                    </View>
                  </GlowSurface>
                ) : (
                  <View style={{ width: '70%', height: 1, backgroundColor: theme.colors.border }} />
                )}
              </View>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{bucket.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, justifyContent: 'center' }}>
        <Legend color={colors.must} label="Must" />
        <Legend color={colors.need} label="Need" />
        <Legend color={colors.want} label="Want" />
      </View>
    </View>
  );
}
