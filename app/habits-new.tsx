import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, IconBadge, LoadingState, ScreenContainer } from '@/components';
import { HABIT_TEMPLATES, HabitForm, useHabitDetail, useHabits, type HabitTemplate } from '@/modules/habits';
import { useAppTheme } from '@/theme';

export default function HabitFormScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { habitId } = useLocalSearchParams<{ habitId?: string }>();
  const isEdit = Boolean(habitId);

  const { habits, createHabit } = useHabits();
  const { habit: existingHabit, loading: loadingExisting, updateHabit } = useHabitDetail(Number(habitId ?? 0));
  const [templateSelection, setTemplateSelection] = useState<{ template: HabitTemplate; nonce: number } | null>(null);

  const existingGroups = Array.from(
    new Set(habits.map(({ habit }) => habit.routine_group).filter((group): group is string => Boolean(group)))
  ).sort((a, b) => a.localeCompare(b));

  if (isEdit && (loadingExisting || !existingHabit)) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: isEdit ? 'Edit Habit' : 'New Habit' }} />

      {!isEdit ? (
        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Browse templates
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
            {HABIT_TEMPLATES.map((template) => (
              <Pressable
                key={template.key}
                onPress={() => setTemplateSelection((current) => ({ template, nonce: (current?.nonce ?? 0) + 1 }))}>
                <Card style={{ width: 128, gap: theme.spacing.sm, alignItems: 'flex-start' }}>
                  <IconBadge name={template.icon as never} color={theme.colors.moduleHabits} size="sm" />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                    {template.name}
                  </Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }} numberOfLines={2}>
                    {template.description}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <HabitForm
        habit={isEdit ? existingHabit : null}
        templateSelection={isEdit ? null : templateSelection}
        existingGroups={existingGroups}
        autoFocusName={!isEdit}
        submitLabel={isEdit ? 'Save changes' : 'Save habit'}
        onSave={async (values) => {
          if (isEdit) {
            await updateHabit(values);
          } else {
            await createHabit(values);
          }
          // Not router.back(): this screen is nested under the Habits tab's own stack, but the
          // "+" on the Today tab pushes it while a *different* tab is active — plain back() can
          // then resolve to wherever that cross-tab push landed rather than the Habits list.
          // dismissTo explicitly lands on the Habits tab's index regardless of how we got here.
          router.dismissTo('/habits');
        }}
      />
    </ScreenContainer>
  );
}
