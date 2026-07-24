import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
    <View style={{ flex: 1 }}>
      <ScreenContainer>
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

      {!loading && habits.length > 0 ? (
        <Pressable
          onPress={() => router.push('/habits/new')}
          accessibilityLabel="Add habit"
          style={{
            position: 'absolute',
            right: theme.spacing.xl,
            bottom: theme.spacing.xl,
            width: 56,
            height: 56,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.moduleHabits,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}
