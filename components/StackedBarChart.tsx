import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { Legend } from './StatsBits';

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
  const totals = data.map((bucket) => bucket.must + bucket.need + bucket.want);
  const maxValue = Math.max(...totals, 1);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm, height }}>
        {data.map((bucket, index) => {
          const total = totals[index];
          const barHeight = Math.max((total / maxValue) * height, total > 0 ? 3 : 1);
          return (
            <View key={bucket.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ height, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                {total > 0 ? (
                  <View style={{ width: '70%', height: barHeight, borderRadius: 3, overflow: 'hidden', flexDirection: 'column-reverse' }}>
                    <View style={{ height: `${(bucket.must / total) * 100}%`, backgroundColor: colors.must }} />
                    <View style={{ height: `${(bucket.need / total) * 100}%`, backgroundColor: colors.need }} />
                    <View style={{ height: `${(bucket.want / total) * 100}%`, backgroundColor: colors.want }} />
                  </View>
                ) : (
                  <View style={{ width: '70%', height: 1, backgroundColor: theme.colors.border }} />
                )}
              </View>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{bucket.label}</Text>
            </View>
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
