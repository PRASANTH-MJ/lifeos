import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Chip, EmptyState, ScreenContainer, UpsellModal, useTabSwipeNavigation } from '@/components';
import { todayKey } from '@/lib/date';
import { useCategories } from '@/modules/categories';
import { HabitListItem, HabitLogSheet, useHabits } from '@/modules/habits';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { useAppTheme } from '@/theme';

type FilterKey = 'all' | number;

export default function HabitsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const swipeHandlers = useTabSwipeNavigation('/habits');
  const { habits, loading, toggleToday, upsertLog, clearLog, moveHabit, archiveHabit, removeHabit, refresh } = useHabits();
  const { categories } = useCategories('habit');
  const [sheetHabitId, setSheetHabitId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const habitGate = useFreeTierGate('habits');
  const [showUpsell, setShowUpsell] = useState(false);

  const onAddHabit = () => {
    if (habitGate.allowed) router.push('/habits/new');
    else setShowUpsell(true);
  };

  const sheetEntry = habits.find((entry) => entry.habit.id === sheetHabitId);
  const usedCategoryIds = new Set(habits.map((h) => h.habit.category_id).filter((id): id is number => id != null));
  const usedCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  const filteredHabits = filter === 'all' ? habits : habits.filter(({ habit }) => habit.category_id === filter);

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
      <ScreenContainer onRefresh={refresh}>
        {!loading && habits.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="No habits yet"
            subtitle="Add a daily or weekly habit to start building your streak."
            ctaLabel="Add your first habit"
            onPressCta={onAddHabit}
          />
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            {usedCategories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
                <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
                {usedCategories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={filter === category.id}
                    color={category.color}
                    onPress={() => setFilter(category.id)}
                  />
                ))}
              </ScrollView>
            ) : null}

            <View style={{ gap: theme.spacing.md }}>
              {filteredHabits.map(({ habit, streak, periodProgress, todayLog }) => {
                const fullIndex = habits.findIndex((h) => h.habit.id === habit.id);
                return (
                  <HabitListItem
                    key={habit.id}
                    habit={habit}
                    streak={streak}
                    periodProgress={periodProgress}
                    todayLog={todayLog}
                    category={categories.find((c) => c.id === habit.category_id)}
                    onToggle={() => toggleToday(habit)}
                    onOpenLogSheet={() => setSheetHabitId(habit.id)}
                    canMoveUp={filter === 'all' && fullIndex > 0}
                    canMoveDown={filter === 'all' && fullIndex < habits.length - 1}
                    onMoveUp={filter === 'all' ? () => moveHabit(habit.id, 'up') : undefined}
                    onMoveDown={filter === 'all' ? () => moveHabit(habit.id, 'down') : undefined}
                    onArchive={() => archiveHabit(habit.id)}
                    onDelete={() => removeHabit(habit.id)}
                  />
                );
              })}
            </View>
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
          onPress={onAddHabit}
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

      <UpsellModal
        visible={showUpsell}
        resourceLabel={LIMIT_LABELS.habits}
        limit={habitGate.limit}
        onClose={() => setShowUpsell(false)}
      />
    </View>
  );
}
