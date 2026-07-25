import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Bar = { label: string; value: number; color: string };

type Props = {
  bars: Bar[];
  formatValue: (value: number) => string;
  height?: number;
};

/** A handful of named, independently-colored bars (not a time series) — used for one-off
 * comparisons like a balance forecast's starting/expected/ending figures. */
export function NamedBarChart({ bars, formatValue, height = 140 }: Props) {
  const theme = useAppTheme();
  const maxValue = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md }}>
      {bars.map((bar) => (
        <View key={bar.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
            {formatValue(bar.value)}
          </Text>
          <View style={{ height, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
            <View
              style={{
                width: '60%',
                height: Math.max((Math.abs(bar.value) / maxValue) * height, 3),
                backgroundColor: bar.color,
                borderRadius: 4,
              }}
            />
          </View>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>{bar.label}</Text>
        </View>
      ))}
    </View>
  );
}
