import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, IconBadge, LoadingState, LogPastEntryModal, ProBadge, ReminderCard, ScreenContainer, SegmentedControl, UpsellModal, showAlert } from '@/components';
import { dayOfYear, formatDisplayDateTime, todayKey } from '@/lib/date';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { useProfile } from '@/modules/profile';
import { useModuleReminders } from '@/modules/reminders';
import {
  computeWorkoutStreak,
  EQUIPMENT_OPTIONS,
  GOALS,
  TIME_OPTIONS,
  WORKOUTS,
  equipmentLabel,
  goalLabel,
  openExercisePicker,
  pickRecommendedWorkout,
  useCustomWorkouts,
  useMuscleRecovery,
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
  const { overallRecovery } = useMuscleRecovery();
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders('workout', 'Time to work out', "Let's get moving today.");
  const allWorkouts = useMemo(() => [...WORKOUTS, ...customWorkouts], [customWorkouts]);
  const refreshAll = async () => {
    await Promise.all([refreshPreferences(), refreshLogs(), refreshCustom()]);
  };
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logWorkoutKey, setLogWorkoutKey] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(todayKey());
  const customWorkoutGate = useFreeTierGate('customWorkouts');
  const [showCustomWorkoutUpsell, setShowCustomWorkoutUpsell] = useState(false);
  const { profile } = useProfile();
  const premium = profile?.premium ?? false;
  const [showDatabaseUpsell, setShowDatabaseUpsell] = useState(false);
  const [showRecoveryUpsell, setShowRecoveryUpsell] = useState(false);

  const onCreateCustomWorkout = () => {
    if (customWorkoutGate.allowed) router.push('/workout/new');
    else setShowCustomWorkoutUpsell(true);
  };

  const onOpenExerciseLibrary = () => {
    if (premium) router.push('/workout/exercises');
    else setShowDatabaseUpsell(true);
  };

  const onOpenMuscleRecovery = () => {
    if (premium) router.push('/workout/recovery');
    else setShowRecoveryUpsell(true);
  };

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

  const onStartWorkout = () => {
    openExercisePicker(router, (picked) => {
      if (picked.length === 0) return;
      router.push({ pathname: '/workout/live-session', params: { keys: picked.map((p) => p.key).join(',') } });
    });
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
    showAlert('Remove this log?', undefined, [
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
                        <IconBadge name="checkmark-circle" color={theme.colors.success} size="sm" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                            {workout?.title ?? log.workout_key}
                          </Text>
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            {formatDisplayDateTime(log.completed_at)}
                          </Text>
                        </View>
                        {log.duration_seconds ? (
                          <View
                            style={{
                              paddingHorizontal: theme.spacing.sm,
                              paddingVertical: 4,
                              borderRadius: theme.radius.full,
                              backgroundColor: theme.colors.moduleTasksMuted,
                            }}>
                            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                              {Math.round(log.duration_seconds / 60)} min
                            </Text>
                          </View>
                        ) : null}
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
              <Card tier="panel" style={{ alignItems: 'center', gap: theme.spacing.md }}>
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
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                    day{currentStreak === 1 ? '' : 's'} streak
                  </Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
                  {completedThisWeek} of {WEEKLY_GOAL} workouts this week
                </Text>
                <View style={{ width: '100%', gap: theme.spacing.xs }}>
                  <Button label="Start Workout" onPress={onStartWorkout} glow />
                  {heroWorkout ? (
                    <Pressable onPress={() => startSession(heroWorkout.key)} style={{ alignItems: 'center', paddingVertical: theme.spacing.xs }}>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        or start "{heroWorkout.title}"
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>

              <Pressable onPress={onOpenMuscleRecovery}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <IconBadge name="pulse" color={theme.colors.moduleTasks} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                        Muscle Recovery
                      </Text>
                      {!premium ? <ProBadge /> : null}
                    </View>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      {premium ? `${overallRecovery}% recovered on average` : 'See which muscles are fatigued vs. ready to train'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                </Card>
              </Pressable>

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

              <Pressable onPress={onOpenExerciseLibrary}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <IconBadge name="body" tone="neutral" />
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                      Exercise Library
                    </Text>
                    {!premium ? <ProBadge /> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                </Card>
              </Pressable>

              <Pressable onPress={() => router.push('/workout/programs')}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <IconBadge name="calendar-outline" tone="neutral" />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                    Suggested Programs
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
                      <IconBadge name="list" tone="neutral" />
                      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                        Browse all workouts
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                    </Card>
                  </Pressable>

                  <Pressable onPress={onCreateCustomWorkout}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <IconBadge name="add-circle-outline" tone="neutral" />
                      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                        Create your own workout
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                    </Card>
                  </Pressable>

                  <Pressable onPress={openLogModal}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <IconBadge name="calendar-outline" tone="neutral" />
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

      <UpsellModal
        visible={showCustomWorkoutUpsell}
        resourceLabel={LIMIT_LABELS.customWorkouts}
        limit={customWorkoutGate.limit}
        onClose={() => setShowCustomWorkoutUpsell(false)}
      />
      <UpsellModal
        visible={showDatabaseUpsell}
        message="The exercise library is a Pro feature — free accounts can still log workouts manually. Go Pro to search hundreds of exercises with instructions and media."
        onClose={() => setShowDatabaseUpsell(false)}
      />
      <UpsellModal
        visible={showRecoveryUpsell}
        message="Muscle Recovery tracking is a Pro feature — see which muscle groups are fatigued and which are ready to train."
        onClose={() => setShowRecoveryUpsell(false)}
      />
    </ScreenContainer>
  );
}
