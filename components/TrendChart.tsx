import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

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
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const average = data.length > 0 ? data.reduce((sum, point) => sum + point.value, 0) / data.length : 0;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
          {label}
        </Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>avg {formatValue(average)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height }}>
        {data.map((point) => (
          <View
            key={point.date}
            style={{
              flex: 1,
              height: Math.max((point.value / maxValue) * height, point.value > 0 ? 3 : 1),
              backgroundColor: point.value > 0 ? color : theme.colors.border,
              borderRadius: 3,
            }}
          />
        ))}
      </View>
    </View>
  );
}
