import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { Legend } from './StatsBits';

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
  const maxValue = Math.max(...data.flatMap((bucket) => [bucket.income, bucket.expense]), 1);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm, height }}>
        {data.map((bucket) => (
          <View key={bucket.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height }}>
              <View
                style={{
                  width: 8,
                  height: Math.max((bucket.income / maxValue) * height, bucket.income > 0 ? 3 : 1),
                  backgroundColor: bucket.income > 0 ? theme.colors.success : theme.colors.border,
                  borderRadius: 3,
                }}
              />
              <View
                style={{
                  width: 8,
                  height: Math.max((bucket.expense / maxValue) * height, bucket.expense > 0 ? 3 : 1),
                  backgroundColor: bucket.expense > 0 ? theme.colors.danger : theme.colors.border,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{bucket.label}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, justifyContent: 'center' }}>
        <Legend color={theme.colors.success} label={`Income · ${formatValue(data.reduce((sum, b) => sum + b.income, 0))}`} />
        <Legend color={theme.colors.danger} label={`Expenses · ${formatValue(data.reduce((sum, b) => sum + b.expense, 0))}`} />
      </View>
    </View>
  );
}
