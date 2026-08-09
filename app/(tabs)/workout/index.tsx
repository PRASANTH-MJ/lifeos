import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, LoadingState, LogPastEntryModal, ReminderCard, ScreenContainer, SegmentedControl } from '@/components';
import { dayOfYear, formatDisplayDateTime, todayKey } from '@/lib/date';
import { useModuleReminders } from '@/modules/reminders';
import {
  computeWorkoutStreak,
  EQUIPMENT_OPTIONS,
  GOALS,
  TIME_OPTIONS,
  WORKOUTS,
  equipmentLabel,
  goalLabel,
  pickRecommendedWorkout,
  useCustomWorkouts,
  useWorkoutLogs,
  useWorkoutPreferences,
} from '@/modules/workout';
import { useAppTheme } from '@/theme';

type WorkoutTab = 'overview' | 'logs';
const WEEKLY_GOAL = 4;

export default function WorkoutScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [tab, setTab] = useState<WorkoutTab>('overview');
  const [moreExpanded, setMoreExpanded] = useState(false);
  const { preferences, loading, updatePreferences, refresh: refreshPreferences } = useWorkoutPreferences();
  const { logs, completedThisWeek, logCompletion, removeLog, refresh: refreshLogs } = useWorkoutLogs();
  const { workouts: customWorkouts, refresh: refreshCustom } = useCustomWorkouts();
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders('workout', 'Time to work out', "Let's get moving today.");
  const allWorkouts = useMemo(() => [...WORKOUTS, ...customWorkouts], [customWorkouts]);
  const refreshAll = async () => {
    await Promise.all([refreshPreferences(), refreshLogs(), refreshCustom()]);
  };
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logWorkoutKey, setLogWorkoutKey] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(todayKey());

  const currentStreak = useMemo(() => computeWorkoutStreak(logs), [logs]);

  const lastWorkout = useMemo(() => {
    if (logs.length === 0) return null;
    return allWorkouts.find((w) => w.key === logs[0].workout_key) ?? null;
  }, [logs, allWorkouts]);

  const recommended = useMemo(() => {
    if (!preferences) return null;
    return pickRecommendedWorkout(allWorkouts, preferences, dayOfYear(new Date()));
  }, [preferences, allWorkouts]);

  const heroWorkout = recommended ?? lastWorkout ?? allWorkouts[0] ?? null;

  const startSession = (workoutKey: string) => {
    router.push({ pathname: '/workout/session/[key]', params: { key: workoutKey } });
  };

  const onSaveLog = async () => {
    if (!logWorkoutKey) return;
    await logCompletion(logWorkoutKey, logDate);
    setLogModalVisible(false);
  };

  const openLogModal = () => {
    setLogWorkoutKey(allWorkouts[0]?.key ?? null);
    setLogDate(todayKey());
    setLogModalVisible(true);
  };

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

  const onDeleteLog = (id: number) => {
    Alert.alert('Remove this log?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeLog(id) },
    ]);
  };

  const weeklyProgress = Math.min(completedThisWeek / WEEKLY_GOAL, 1);

  return (
    <ScreenContainer scroll={false} onRefresh={refreshAll}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
              <Pressable onPress={() => router.push('/workout/analytics')} hitSlop={8}>
                <Ionicons name="stats-chart-outline" size={24} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable onPress={openLogModal} hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, gap: theme.spacing.lg }}>
        <SegmentedControl
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'logs', label: 'Logs' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'logs' ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {logs.length === 0 ? (
              <EmptyState icon="time-outline" title="No workouts logged yet" subtitle="Completed and past workouts will show up here." />
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {logs.map((log) => {
                  const workout = allWorkouts.find((w) => w.key === log.workout_key);
                  return (
                    <Pressable key={log.id} onLongPress={() => onDeleteLog(log.id)}>
                      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                            {workout?.title ?? log.workout_key}
                          </Text>
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            {formatDisplayDateTime(log.completed_at)}
                            {log.duration_seconds ? ` · ${Math.round(log.duration_seconds / 60)} min` : ''}
                          </Text>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: theme.spacing.xl }}>
              <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
                <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 9, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={{
                      position: 'absolute',
                      width: 120,
                      height: 120,
                      borderRadius: 60,
                      borderWidth: 9,
                      borderColor: theme.colors.moduleTasks,
                      opacity: weeklyProgress,
                    }}
                  />
                  <Ionicons name="flame" size={20} color={theme.colors.moduleTasks} />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                    {currentStreak}
                  </Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>day streak</Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
                  {completedThisWeek} of {WEEKLY_GOAL} workouts this week
                </Text>
                {heroWorkout ? (
                  <View style={{ width: '100%', gap: theme.spacing.xs }}>
                    <Button label={`Start: ${heroWorkout.title}`} onPress={() => startSession(heroWorkout.key)} />
                    <Pressable onPress={() => router.push('/workout/all')} style={{ alignItems: 'center', paddingVertical: theme.spacing.xs }}>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Pick a different workout</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>

              {reminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  state={reminder}
                  onSave={(next) => saveReminder(reminder.id, next)}
                  onRemove={reminders.length > 1 ? () => removeReminder(reminder.id) : undefined}
                  color={theme.colors.moduleTasks}
                />
              ))}
              <Button label={reminders.length > 0 ? 'Add another reminder' : 'Add a reminder'} variant="secondary" onPress={addReminder} />

              <Pressable onPress={() => router.push('/workout/exercises')}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Ionicons name="body" size={20} color={theme.colors.textSecondary} />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                    Exercise Library
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                </Card>
              </Pressable>

              <Pressable onPress={() => setMoreExpanded((v) => !v)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
                    Preferences & more
                  </Text>
                  <Ionicons name={moreExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textTertiary} />
                </View>
              </Pressable>

              {moreExpanded ? (
                <View style={{ gap: theme.spacing.xl }}>
                  <View style={{ gap: theme.spacing.md }}>
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

                  <Pressable onPress={() => router.push('/workout/new')}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <Ionicons name="add-circle-outline" size={20} color={theme.colors.textSecondary} />
                      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                        Create your own workout
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                    </Card>
                  </Pressable>

                  <Pressable onPress={openLogModal}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
                      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                        Log a past workout
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                    </Card>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}
      </View>

      <LogPastEntryModal
        visible={logModalVisible}
        title="Log a past workout"
        items={allWorkouts.map((w) => ({ key: w.key, label: w.title }))}
        selectedItemKey={logWorkoutKey}
        onSelectItem={setLogWorkoutKey}
        date={logDate}
        onSelectDate={setLogDate}
        onClose={() => setLogModalVisible(false)}
        onSave={onSaveLog}
        moduleColor={theme.colors.moduleTasks}
        moduleMutedColor={theme.colors.moduleTasksMuted}
      />
    </ScreenContainer>
  );
}
