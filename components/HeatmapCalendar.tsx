import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { addDays, todayKey } from '@/lib/date';

type Props = {
  /** dateKey (`YYYY-MM-DD`) -> intensity. 0 or missing = empty cell. */
  values: Record<string, number>;
  /** How many 7-day columns to render, oldest to newest, ending today. */
  weeks?: number;
  accentColor?: string;
  maxIntensity?: number;
  onPressDay?: (dateKey: string) => void;
};

const CELL_SIZE = 14;
const CELL_GAP = 3;

export function HeatmapCalendar({ values, weeks = 18, accentColor, maxIntensity = 1, onPressDay }: Props) {
  const theme = useAppTheme();
  const color = accentColor ?? theme.colors.primary;
  const totalDays = weeks * 7;

  const days: string[] = [];
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    days.push(addDays(todayKey(), -i));
  }

  const columns: string[][] = [];
  for (let c = 0; c < weeks; c += 1) {
    columns.push(days.slice(c * 7, c * 7 + 7));
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: CELL_GAP }}>
      {columns.map((column) => (
        <View key={column[0]} style={{ gap: CELL_GAP }}>
          {column.map((dateKey) => {
            const intensity = Math.min(values[dateKey] ?? 0, maxIntensity) / maxIntensity;
            const cell = (
              <View
                style={[
                  styles.cell,
                  {
                    backgroundColor: intensity > 0 ? withAlpha(color, 0.25 + intensity * 0.75) : theme.colors.border,
                    borderRadius: theme.radius.sm,
                  },
                ]}
              />
            );
            if (!onPressDay) {
              return <View key={dateKey}>{cell}</View>;
            }
            return (
              <Pressable key={dateKey} onPress={() => onPressDay(dateKey)}>
                {cell}
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

function withAlpha(hexOrRgb: string, alpha: number): string {
  if (hexOrRgb.startsWith('#') && hexOrRgb.length === 7) {
    const r = parseInt(hexOrRgb.slice(1, 3), 16);
    const g = parseInt(hexOrRgb.slice(3, 5), 16);
    const b = parseInt(hexOrRgb.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hexOrRgb;
}

const styles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
});
