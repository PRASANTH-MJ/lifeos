import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Legend } from './StatsBits';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

type Bucket = { label: string; income: number; expense: number };

type Props = {
  data: Bucket[];
  formatValue?: (value: number) => string;
  height?: number;
};

/** Grouped income/expense bars per time bucket — the cash-flow counterpart to `<TrendChart>`'s
 * single series, since income and expense need to be visually compared side by side per period. */
export function BarPairChart({ data, formatValue = (v) => String(Math.round(v)), height = 120 }: Props) {
  const theme = useAppTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const maxValue = Math.max(...data.flatMap((bucket) => [bucket.income, bucket.expense]), 1);
  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  const gradientBar = (value: number, color: string) => (
    <View
      style={{
        width: 8,
        height: Math.max((value / maxValue) * height, value > 0 ? 3 : 1),
        borderRadius: theme.radius.full,
        overflow: 'hidden',
        backgroundColor: value > 0 ? undefined : theme.colors.border,
      }}>
      {value > 0 && <LinearGradient colors={[color, withAlpha(color, 0.55)]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }} />}
    </View>
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {selected ? (
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
          {selected.label} · income {formatValue(selected.income)} · expenses {formatValue(selected.expense)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm, height }}>
        {data.map((bucket, index) => (
          <Pressable
            key={bucket.label}
            onPress={() => setSelectedIndex(selectedIndex === index ? null : index)}
            style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height }}>
              {gradientBar(bucket.income, theme.colors.success)}
              {gradientBar(bucket.expense, theme.colors.danger)}
            </View>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{bucket.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, justifyContent: 'center' }}>
        <Legend color={theme.colors.success} label={`Income · ${formatValue(data.reduce((sum, b) => sum + b.income, 0))}`} />
        <Legend color={theme.colors.danger} label={`Expenses · ${formatValue(data.reduce((sum, b) => sum + b.expense, 0))}`} />
      </View>
    </View>
  );
}
