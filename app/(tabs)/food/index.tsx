import { Ionicons } from '@expo/vector-icons';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, EmptyState, ScreenContainer, StatCard } from '@/components';
import { addDays, formatDisplayDate, todayKey } from '@/lib/date';
import { MEALS, mealLabel, useFoodDay } from '@/modules/food';
import { useAppTheme } from '@/theme';

export default function FoodScreen() {
  const theme = useAppTheme();
  const [date, setDate] = useState(todayKey());
  const { loading, totals, byMeal, deleteLog } = useFoodDay(date);

  const onDelete = (id: number) => {
    Alert.alert('Remove entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteLog(id) },
    ]);
  };

  const isEmpty = !loading && MEALS.every((meal) => byMeal[meal].length === 0);

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href={{ pathname: '/food/new', params: { date } }} asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => setDate((d) => addDays(d, -1))} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.textSecondary} />
          </Pressable>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            {formatDisplayDate(date)}
          </Text>
          <Pressable onPress={() => setDate((d) => addDays(d, 1))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <StatCard label="Calories" value={String(totals.calories)} color={theme.colors.primary} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard label="Protein (g)" value={String(totals.protein)} />
          <StatCard label="Carbs (g)" value={String(totals.carbs)} />
          <StatCard label="Fat (g)" value={String(totals.fat)} />
        </View>

        {isEmpty ? (
          <EmptyState icon="restaurant-outline" title="Nothing logged" subtitle="Tap + to log a meal or snack." />
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            {MEALS.filter((meal) => byMeal[meal].length > 0).map((meal) => (
              <View key={meal} style={{ gap: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                  {mealLabel(meal)}
                </Text>
                {byMeal[meal].map((log) => (
                  <Pressable key={log.id} onLongPress={() => onDelete(log.id)}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
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
              </View>
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
