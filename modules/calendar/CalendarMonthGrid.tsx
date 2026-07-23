import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { buildMonthGrid, monthLabel, todayKey } from '@/lib/date';
import { useAppTheme } from '@/theme';

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  year: number;
  month: number;
  selectedDate: string;
  markedDates: Set<string>;
  onSelectDate: (dateKey: string) => void;
  onChangeMonth: (delta: number) => void;
};

export function CalendarMonthGrid({ year, month, selectedDate, markedDates, onSelectDate, onChangeMonth }: Props) {
  const theme = useAppTheme();
  const cells = buildMonthGrid(year, month);
  const today = todayKey();
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => onChangeMonth(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
        </Pressable>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          {monthLabel(year, month)}
        </Text>
        <Pressable onPress={() => onChangeMonth(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_HEADERS.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={{ flex: 1, textAlign: 'center', color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={week[0]} style={{ flexDirection: 'row' }}>
          {week.map((dateKey) => {
            const inMonth = Number(dateKey.split('-')[1]) - 1 === month;
            const isToday = dateKey === today;
            const isSelected = dateKey === selectedDate;
            const dayNumber = Number(dateKey.split('-')[2]);

            return (
              <Pressable key={dateKey} onPress={() => onSelectDate(dateKey)} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: theme.radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? theme.colors.primary : isToday ? theme.colors.primaryMuted : 'transparent',
                  }}>
                  <Text
                    style={{
                      color: isSelected ? '#fff' : inMonth ? theme.colors.textPrimary : theme.colors.textTertiary,
                      fontSize: theme.typography.size.sm,
                      fontWeight: isToday || isSelected ? theme.typography.weight.bold : theme.typography.weight.regular,
                    }}>
                    {dayNumber}
                  </Text>
                </View>
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    marginTop: 2,
                    backgroundColor: markedDates.has(dateKey) ? theme.colors.moduleTasks : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
