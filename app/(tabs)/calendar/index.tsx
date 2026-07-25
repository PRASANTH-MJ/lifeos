import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { CalendarMonthGrid, useCalendarDay, useMonthMarkers } from '@/modules/calendar';
import { useAppTheme } from '@/theme';

export default function CalendarScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const today = todayKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split('-').map(Number);
    return { year, month: month - 1 };
  });

  const markedDates = useMonthMarkers(cursor.year, cursor.month);
  const { events, tasksDue, habitsDue, loading, toggleHabit, toggleTask, refresh } = useCalendarDay(selectedDate);

  const onChangeMonth = (delta: number) => {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const isEmpty = !loading && events.length === 0 && tasksDue.length === 0 && habitsDue.length === 0;

  return (
    <ScreenContainer onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href={{ pathname: '/calendar/new', params: { date: selectedDate } }} asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <Card>
          <CalendarMonthGrid
            year={cursor.year}
            month={cursor.month}
            selectedDate={selectedDate}
            markedDates={markedDates}
            onSelectDate={setSelectedDate}
            onChangeMonth={onChangeMonth}
          />
        </Card>

        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            {formatDisplayDate(selectedDate)}
          </Text>

          {isEmpty ? (
            <Card>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                Nothing scheduled. Tap + to add an event.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {events.map((event) => (
                <Link key={`event-${event.id}`} href={{ pathname: '/calendar/[id]', params: { id: String(event.id) } }} asChild>
                  <Pressable>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <Ionicons name="calendar" size={18} color={theme.colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                          {event.title}
                        </Text>
                        {event.start_time ? (
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            {event.start_time}
                            {event.end_time ? ` – ${event.end_time}` : ''}
                          </Text>
                        ) : null}
                      </View>
                    </Card>
                  </Pressable>
                </Link>
              ))}

              {tasksDue.map((task) => (
                <Pressable key={`task-${task.id}`} onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: String(task.id) } })}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleTask(task);
                      }}
                      hitSlop={8}>
                      <Ionicons
                        name={task.completed_at ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={task.completed_at ? theme.colors.success : theme.colors.moduleTasks}
                      />
                    </Pressable>
                    <Text
                      style={{
                        flex: 1,
                        color: theme.colors.textPrimary,
                        fontSize: theme.typography.size.base,
                        textDecorationLine: task.completed_at ? 'line-through' : 'none',
                      }}>
                      {task.title}
                    </Text>
                  </Card>
                </Pressable>
              ))}

              {habitsDue.map(({ habit, completed }) => (
                <Pressable key={`habit-${habit.id}`} onPress={() => router.push({ pathname: '/habits/[id]', params: { id: String(habit.id) } })}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleHabit(habit.id);
                      }}
                      hitSlop={8}>
                      <Ionicons
                        name={completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={completed ? theme.colors.success : theme.colors.moduleHabits}
                      />
                    </Pressable>
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>{habit.name}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
