import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, IconBadge, ProgressBar, ReminderCard, ScreenContainer, ShareCardModal, StreakBadge, type ShareCardData, showAlert } from '@/components';
import { addDays, formatDisplayDate, monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { MEALS, mealLabel, useFoodDay, useFoodStreak, type Meal } from '@/modules/food';
import { useModuleReminders } from '@/modules/reminders';
import { useAppTheme } from '@/theme';

const MEAL_ICONS: Record<Meal, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

export default function FoodScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [date, setDate] = useState(todayKey());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(todayKey()));
  const { loading, totals, byMeal, deleteLog, createLog, refresh } = useFoodDay(date);
  const { logs: yesterdayLogs } = useFoodDay(addDays(date, -1));
  const streak = useFoodStreak();
  const [repeating, setRepeating] = useState(false);
  const [shareCard, setShareCard] = useState<ShareCardData | null>(null);
  const onShareStreak = () => {
    setShareCard({
      eyebrow: 'Food streak',
      value: String(streak),
      valueLabel: `day streak${streak === 1 ? '' : 's'}`,
      detail: 'Logging every day on Flowsy',
      icon: 'restaurant',
      accentColor: theme.colors.primary,
    });
  };
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders(
    'food',
    'Log your meals',
    "Don't forget to log what you've eaten today."
  );

  const onDelete = (id: number) => {
    showAlert('Remove entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteLog(id) },
    ]);
  };

  const isEmpty = !loading && MEALS.every((meal) => byMeal[meal].length === 0);

  const onRepeatYesterday = async () => {
    setRepeating(true);
    try {
      for (const log of yesterdayLogs) {
        await createLog({
          description: log.description,
          meal: log.meal,
          calories: log.calories,
          proteinG: log.protein_g,
          carbsG: log.carbs_g,
          fatG: log.fat_g,
        });
      }
    } finally {
      setRepeating(false);
    }
  };

  return (
    <ScreenContainer onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
              <Link href="/food/plans" asChild>
                <Pressable hitSlop={8}>
                  <Ionicons name="restaurant-outline" size={22} color={theme.colors.textSecondary} />
                </Pressable>
              </Link>
              <Link href="/food/analytics" asChild>
                <Pressable hitSlop={8}>
                  <Ionicons name="stats-chart-outline" size={22} color={theme.colors.textSecondary} />
                </Pressable>
              </Link>
              <Link href={{ pathname: '/food-new', params: { date } }} asChild>
                <Pressable hitSlop={8}>
                  <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => setDate((d) => addDays(d, -1))} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.textSecondary} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Pressable
              onPress={() => {
                setDateCursor(monthCursorOf(date));
                setDatePickerVisible(true);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                {formatDisplayDate(date)}
              </Text>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.textTertiary} />
            </Pressable>
            <StreakBadge streak={streak} onPress={onShareStreak} />
          </View>
          <Pressable onPress={() => setDate((d) => addDays(d, 1))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <IconBadge name="flame" color={theme.colors.primary} size="md" />
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Calories
            </Text>
          </View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            {totals.calories}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>kcal today</Text>
        </Card>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          {(
            [
              { label: 'Protein', value: totals.protein, icon: 'barbell-outline' as const, color: theme.colors.success },
              { label: 'Carbs', value: totals.carbs, icon: 'leaf-outline' as const, color: theme.colors.primary },
              { label: 'Fat', value: totals.fat, icon: 'water-outline' as const, color: theme.colors.warning },
            ]
          ).map((macro) => {
            const maxMacro = Math.max(totals.protein, totals.carbs, totals.fat, 1);
            return (
              <Card key={macro.label} tier="elevated" style={{ flex: 1, gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                  <IconBadge name={macro.icon} color={macro.color} size="sm" />
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                    {macro.label}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                  {macro.value}g
                </Text>
                <ProgressBar progress={macro.value / maxMacro} color={macro.color} height={4} />
              </Card>
            );
          })}
        </View>

        {reminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            state={reminder}
            onSave={(next) => saveReminder(reminder.id, next)}
            onRemove={reminders.length > 1 ? () => removeReminder(reminder.id) : undefined}
            color={theme.colors.primary}
          />
        ))}
        <Button label={reminders.length > 0 ? 'Add another reminder' : 'Add a reminder'} variant="secondary" onPress={addReminder} />

        {isEmpty && yesterdayLogs.length > 0 ? (
          <Button label={`Repeat yesterday's ${yesterdayLogs.length} meal${yesterdayLogs.length === 1 ? '' : 's'}`} variant="secondary" onPress={onRepeatYesterday} loading={repeating} />
        ) : null}

        {isEmpty ? (
          <EmptyState icon="restaurant-outline" title="Nothing logged" subtitle="Tap + to log a meal or snack." />
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            {MEALS.filter((meal) => byMeal[meal].length > 0).map((meal) => (
              <Card key={meal} tier="panel" style={{ gap: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                  {mealLabel(meal)}
                </Text>
                {byMeal[meal].map((log) => (
                  <Pressable
                    key={log.id}
                    onPress={() => router.push({ pathname: '/food-new', params: { date, id: String(log.id) } })}
                    onLongPress={() => onDelete(log.id)}>
                    <Card tier="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <IconBadge name={MEAL_ICONS[meal]} color={theme.colors.primary} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>{log.description}</Text>
                        {log.protein_g || log.carbs_g || log.fat_g ? (
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            P {log.protein_g ?? 0}g · C {log.carbs_g ?? 0}g · F {log.fat_g ?? 0}g
                          </Text>
                        ) : null}
                      </View>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                        {log.calories} cal
                      </Text>
                    </Card>
                  </Pressable>
                ))}
              </Card>
            ))}
          </View>
        )}
      </View>

      <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.lg,
            }}>
            <CalendarMonthGrid
              year={dateCursor.year}
              month={dateCursor.month}
              selectedDate={date}
              markedDates={new Set([date])}
              onSelectDate={(dateKey) => {
                setDate(dateKey);
                setDatePickerVisible(false);
              }}
              onChangeMonth={(delta) => setDateCursor((cursor) => shiftMonth(cursor, delta))}
            />
          </View>
        </View>
      </Modal>
      <ShareCardModal visible={!!shareCard} onClose={() => setShareCard(null)} data={shareCard} />
    </ScreenContainer>
  );
}
