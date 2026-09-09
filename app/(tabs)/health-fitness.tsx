import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, IconBadge, LineChart, ScreenContainer, StatCard, TextField, useTabSwipeNavigation } from '@/components';
import { useBodyMeasurements } from '@/modules/bodyMetrics';
import { todayKey } from '@/lib/date';
import { shouldShowCycleTracking } from '@/modules/cycle';
import { useFoodDay } from '@/modules/food';
import { useProfile } from '@/modules/profile';
import { useWaterDay } from '@/modules/water';
import { useWorkoutWeekAnalytics } from '@/modules/workout';
import { useAppTheme } from '@/theme';

type ModuleHref = '/food' | '/workout' | '/water' | '/cardio' | '/cycle';

type ModuleLink = {
  href: ModuleHref;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
};

/** The tab bar slot that used to be "Habits" — Habits itself moved to More's new "Productivity"
 * section (see more.tsx), and this groups Food/Workout/Water instead, mirroring the same three
 * modules already listed under More's "Health & Body" section. */
export default function HealthFitnessScreen() {
  const theme = useAppTheme();
  const swipeHandlers = useTabSwipeNavigation('/health-fitness');
  const today = todayKey();

  const { profile } = useProfile();
  const { totals: foodTotals } = useFoodDay(today);
  const { totalMl: waterMl, goalMl: waterGoalMl } = useWaterDay(today);
  const { totalCount: workoutsThisWeek } = useWorkoutWeekAnalytics();
  const { entries: weightEntries, addEntry: addWeightEntry } = useBodyMeasurements();
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const waterProgress = waterGoalMl > 0 ? Math.min(waterMl / waterGoalMl, 1) : 0;
  const latestWeightKg = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight_kg : null;

  const onSaveWeight = async () => {
    const kg = Number(weightInput);
    if (!kg || kg <= 0) return;
    setSavingWeight(true);
    try {
      await addWeightEntry(today, kg);
      setWeightInput('');
    } finally {
      setSavingWeight(false);
    }
  };

  const modules: ModuleLink[] = [
    {
      href: '/workout',
      icon: 'barbell',
      title: 'Workout Tracker',
      subtitle: "Today's recommendation based on your goals",
      color: theme.colors.moduleTasks,
    },
    {
      href: '/food',
      icon: 'restaurant',
      title: 'Food Tracker',
      subtitle: 'Meals, calories, and macros by day',
      color: theme.colors.moduleTasks,
    },
    {
      href: '/water',
      icon: 'water',
      title: 'Water Tracker',
      subtitle: 'Log your daily water intake',
      color: theme.colors.moduleTasks,
    },
    {
      href: '/cardio',
      icon: 'walk',
      title: 'Activity Tracker',
      subtitle: 'Running, walking, hiking, cycling, swimming, yoga, and sports — with levels',
      color: theme.colors.moduleTasks,
    },
    ...(shouldShowCycleTracking(profile?.gender ?? null)
      ? [
          {
            href: '/cycle' as const,
            icon: 'water' as const,
            title: 'Cycle Tracking',
            subtitle: 'Periods, predictions, and mood by phase — private, opt-in',
            color: theme.colors.moduleTasks,
          },
        ]
      : []),
  ];

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
      <ScreenContainer edges={['top', 'bottom']}>
        <View style={{ gap: theme.spacing.xl }}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.size['3xl'],
              fontWeight: theme.typography.weight.bold,
            }}>
            Health & Fitness
          </Text>

          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <StatCard label="Calories today" value={String(Math.round(foodTotals.calories))} color={theme.colors.moduleTasks} />
            <StatCard label="Workouts this week" value={String(workoutsThisWeek)} color={theme.colors.moduleTasks} />
          </View>

          <Card tier="elevated" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="water" color={theme.colors.moduleTasks} size="sm" />
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.size.sm,
                  fontWeight: theme.typography.weight.semibold,
                  flex: 1,
                }}>
                Water today
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
                {waterMl} / {waterGoalMl} ml
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
              <View style={{ width: `${waterProgress * 100}%`, height: '100%', backgroundColor: theme.colors.moduleTasks }} />
            </View>
          </Card>

          <Card tier="elevated" style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="body" color={theme.colors.moduleTasks} size="sm" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
                Body Weight
              </Text>
              {latestWeightKg != null ? (
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{latestWeightKg} kg</Text>
              ) : null}
            </View>

            {weightEntries.length >= 2 ? (
              <LineChart
                label="Weight trend (kg)"
                data={weightEntries.map((entry) => ({ date: entry.date, value: entry.weight_kg }))}
                color={theme.colors.moduleTasks}
                formatValue={(v) => `${v.toFixed(1)} kg`}
              />
            ) : (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                Log a couple of entries to see your trend.
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField label="Today's weight (kg)" placeholder="70" value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" />
              </View>
              <Button label="Log" onPress={onSaveWeight} loading={savingWeight} disabled={!weightInput.trim()} />
            </View>
          </Card>

          <View style={{ gap: theme.spacing.sm }}>
            {modules.map((mod) => (
              <Link key={mod.href} href={mod.href} asChild>
                <Pressable>
                  <Card tier="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name={mod.icon} color={mod.color} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: theme.colors.textPrimary,
                          fontSize: theme.typography.size.base,
                          fontWeight: theme.typography.weight.semibold,
                        }}>
                        {mod.title}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                        {mod.subtitle}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      </ScreenContainer>
    </View>
  );
}
