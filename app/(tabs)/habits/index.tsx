import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState, ScreenContainer } from '@/components';
import { todayKey } from '@/lib/date';
import { useCategories } from '@/modules/categories';
import { HabitListItem, HabitLogSheet, useHabits } from '@/modules/habits';
import { useAppTheme } from '@/theme';

export default function HabitsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { habits, loading, toggleToday, upsertLog, clearLog } = useHabits();
  const { categories } = useCategories('habit');
  const [sheetHabitId, setSheetHabitId] = useState<number | null>(null);

  const sheetEntry = habits.find((entry) => entry.habit.id === sheetHabitId);

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/habits/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.moduleHabits} />
              </Pressable>
            </Link>
          ),
        }}
      />
      {!loading && habits.length === 0 ? (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title="No habits yet"
          subtitle="Add a daily or weekly habit to start building your streak."
          ctaLabel="Add your first habit"
          onPressCta={() => router.push('/habits/new')}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {habits.map(({ habit, streak, periodProgress, todayLog }) => (
            <HabitListItem
              key={habit.id}
              habit={habit}
              streak={streak}
              periodProgress={periodProgress}
              todayLog={todayLog}
              category={categories.find((c) => c.id === habit.category_id)}
              onToggle={() => toggleToday(habit)}
              onOpenLogSheet={() => setSheetHabitId(habit.id)}
            />
          ))}
        </View>
      )}

      {sheetEntry ? (
        <HabitLogSheet
          visible
          habit={sheetEntry.habit}
          date={todayKey()}
          existingLog={sheetEntry.todayLog}
          onClose={() => setSheetHabitId(null)}
          onSave={(values) => upsertLog(sheetEntry.habit.id, values)}
          onClear={() => clearLog(sheetEntry.habit.id)}
        />
      ) : null}
    </ScreenContainer>
  );
}
