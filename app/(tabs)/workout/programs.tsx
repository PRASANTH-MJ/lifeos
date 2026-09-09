import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, ScreenContainer, UpsellModal } from '@/components';
import { healthGoalToContentGoal, useUserDetails } from '@/modules/onboarding';
import { useProfile } from '@/modules/profile';
import { equipmentLabel, isProgramFree, useExerciseCatalogSync, usePrograms, useRoutineProgress, type Equipment } from '@/modules/workout';
import { useAppTheme } from '@/theme';

const GOAL_LABELS: Record<string, string> = {
  general: 'General',
  strength: 'Strength',
  cardio: 'Cardio',
  flexibility: 'Flexibility',
  'weight-loss': 'Weight Loss',
  'muscle-building': 'Muscle Building',
  recovery: 'Gentle & Recovery',
};

export default function ProgramsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { programs, loading } = usePrograms();
  // Web has no bundled seed for programs (unlike native's SQLite migrations) — this screen is
  // often the FIRST workout screen a user opens, so it can't rely on the Exercises screen having
  // mounted useExerciseCatalogSync first. Native's `syncNow` just re-pulls data it already has
  // bundled, so this is safe there too.
  const { syncing, error: syncError, syncNow } = useExerciseCatalogSync();
  const { details } = useUserDetails();
  const { profile } = useProfile();
  const { progress } = useRoutineProgress();
  const recommendedGoal = healthGoalToContentGoal(details?.healthGoal ?? null);
  const [showUpsell, setShowUpsell] = useState(false);
  const activeProgram = progress ? programs.find((p) => p.key === progress.programKey) : null;

  // Stable sort — matching-goal programs float to the top, but relative order within each group
  // is untouched, so this never looks like a shuffle on every refresh.
  const sorted = useMemo(
    () => [...programs].sort((a, b) => Number(b.goal === recommendedGoal) - Number(a.goal === recommendedGoal)),
    [programs, recommendedGoal]
  );

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: 'Suggested Programs' }} />
      {loading || (programs.length === 0 && syncing) ? (
        <LoadingState />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.key}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xl }}
          ListEmptyComponent={
            syncError ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't load programs"
                subtitle={syncError}
                ctaLabel="Retry"
                onPressCta={syncNow}
              />
            ) : (
              <EmptyState icon="calendar-outline" title="No programs yet" />
            )
          }
          ListHeaderComponent={
            activeProgram ? (
              <Pressable onPress={() => router.push({ pathname: '/workout/programs/[key]', params: { key: activeProgram.key } })}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.primaryMuted }}>
                  <IconBadge name="play" color={theme.colors.primary} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                      Continue: {activeProgram.title}
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>
                      Week {progress?.weekNumber} · Day {(progress?.dayIndex ?? 0) + 1} of {activeProgram.days.length}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
                </Card>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const recommended = item.goal === recommendedGoal;
            const locked = !profile?.premium && !isProgramFree(item.key);
            const onPress = () => {
              if (locked) setShowUpsell(true);
              else router.push({ pathname: '/workout/programs/[key]', params: { key: item.key } });
            };
            return (
              <Pressable onPress={onPress}>
                <Card style={{ gap: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <IconBadge name="calendar-outline" color={theme.colors.moduleTasks} size="sm" />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
                      {item.title}
                    </Text>
                    {locked ? <Ionicons name="lock-closed" size={16} color={theme.colors.textTertiary} /> : null}
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  </View>
                  {locked ? (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 3,
                        borderRadius: theme.radius.full,
                        backgroundColor: theme.colors.warningMuted,
                      }}>
                      <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                        Pro
                      </Text>
                    </View>
                  ) : recommended ? (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 3,
                        borderRadius: theme.radius.full,
                        backgroundColor: theme.colors.primaryMuted,
                      }}>
                      <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                        Recommended for you
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{item.description}</Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                    {GOAL_LABELS[item.goal] ?? item.goal} · {item.days.length} day{item.days.length === 1 ? '' : 's'}/week · {item.weeks} week
                    {item.weeks === 1 ? '' : 's'} · {equipmentLabel(item.equipment as Equipment)}
                  </Text>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
      <UpsellModal
        visible={showUpsell}
        message="This program is part of the Pro library. Go Pro to unlock all workout programs."
        onClose={() => setShowUpsell(false)}
      />
    </ScreenContainer>
  );
}
