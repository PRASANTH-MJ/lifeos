import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Chip, LoadingState, ScreenContainer } from '@/components';
import { dayOfYear } from '@/lib/date';
import {
  EQUIPMENT_OPTIONS,
  GOALS,
  TIME_OPTIONS,
  WORKOUTS,
  equipmentLabel,
  goalLabel,
  pickRecommendedWorkout,
  useWorkoutLogs,
  useWorkoutPreferences,
} from '@/modules/workout';
import { useAppTheme } from '@/theme';

export default function WorkoutScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { preferences, loading, updatePreferences, refresh: refreshPreferences } = useWorkoutPreferences();
  const { completedThisWeek, logCompletion, refresh: refreshLogs } = useWorkoutLogs();
  const refreshAll = async () => {
    await Promise.all([refreshPreferences(), refreshLogs()]);
  };

  const recommended = useMemo(() => {
    if (!preferences) return null;
    return pickRecommendedWorkout(WORKOUTS, preferences, dayOfYear(new Date()));
  }, [preferences]);

  const toggleEquipment = (equipment: (typeof EQUIPMENT_OPTIONS)[number]) => {
    if (!preferences) return;
    const has = preferences.equipment.includes(equipment);
    const next = has ? preferences.equipment.filter((e) => e !== equipment) : [...preferences.equipment, equipment];
    updatePreferences({ equipment: next });
  };

  if (loading || !preferences) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer onRefresh={refreshAll}>
      <View style={{ gap: theme.spacing.xl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Ionicons name="barbell" size={20} color={theme.colors.moduleTasks} />
          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            {completedThisWeek} workouts completed this week
          </Text>
        </Card>

        {recommended ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              Today's pick
            </Text>
            <Card style={{ gap: theme.spacing.md }}>
              <View>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.semibold }}>
                  {recommended.title}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  {goalLabel(recommended.goal)} · {equipmentLabel(recommended.equipment)} · {recommended.minutes} min
                </Text>
              </View>
              <View style={{ gap: theme.spacing.xs }}>
                {recommended.exercises.map((exercise) => (
                  <Text key={exercise} style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
                    • {exercise}
                  </Text>
                ))}
              </View>
              <Pressable
                onPress={() => logCompletion(recommended.key)}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: theme.spacing.xl,
                  paddingVertical: theme.spacing.md,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.moduleTasks,
                }}>
                <Text style={{ color: '#fff', fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>Mark complete</Text>
              </Pressable>
            </Card>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Your preferences
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Goal</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {GOALS.map((goal) => (
                <Chip key={goal} label={goalLabel(goal)} selected={preferences.goal === goal} onPress={() => updatePreferences({ goal })} />
              ))}
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Equipment you have</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {EQUIPMENT_OPTIONS.map((equipment) => (
                <Chip
                  key={equipment}
                  label={equipmentLabel(equipment)}
                  selected={preferences.equipment.includes(equipment)}
                  onPress={() => toggleEquipment(equipment)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Time available</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {TIME_OPTIONS.map((minutes) => (
                <Chip
                  key={minutes}
                  label={`${minutes} min`}
                  selected={preferences.timeMinutes === minutes}
                  onPress={() => updatePreferences({ timeMinutes: minutes })}
                />
              ))}
            </View>
          </View>
        </View>

        <Pressable onPress={() => router.push('/workout/all')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Ionicons name="list" size={20} color={theme.colors.textSecondary} />
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Browse all workouts
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Card>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
