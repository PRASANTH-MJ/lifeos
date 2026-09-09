import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, IconBadge } from '@/components';
import { dayOfYear, todayKey } from '@/lib/date';
import { findPattern } from '@/modules/breathing';
import { predictNextPeriod, useCycleLogs, useCyclePreferences } from '@/modules/cycle';
import { useBudgetAlert } from '@/modules/finance';
import { useFoodDay } from '@/modules/food';
import { useHabits } from '@/modules/habits';
import { moodEmoji } from '@/modules/journal';
import { findSession } from '@/modules/meditation';
import { findExercise } from '@/modules/mind-training';
import { useUserDetails } from '@/modules/onboarding';
import {
  FINANCE_GOAL_TIPS,
  GOAL_TIPS,
  HEALTH_GOAL_TO_WORKOUT_GOAL,
  useMoodRecommendation,
  type FinancialGoalKey,
  type HealthGoalKey,
} from '@/modules/recommendations';
import { useVoiceCommands, type VoiceCommand } from '@/modules/voice';
import { pickRecommendedWorkout, useWorkoutLogs, useWorkoutPreferences, WORKOUT_GOAL_ICON, WORKOUTS } from '@/modules/workout';
import { suggestedWaterGoalMl, useWaterDay } from '@/modules/water';
import { useAppTheme } from '@/theme';

const WIDGETS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; href: string; color: 'primary' | 'tasks' | 'journal' }[] = [
  { key: 'habits', label: 'Habits', icon: 'flame', href: '/habits', color: 'primary' },
  { key: 'tasks', label: 'Tasks', icon: 'checkbox', href: '/tasks', color: 'primary' },
  { key: 'journal', label: 'Journal', icon: 'book', href: '/journal', color: 'journal' },
  { key: 'water', label: 'Water', icon: 'water', href: '/water', color: 'tasks' },
  { key: 'food', label: 'Food', icon: 'restaurant', href: '/food', color: 'tasks' },
  { key: 'workout', label: 'Workout', icon: 'barbell', href: '/workout', color: 'tasks' },
  { key: 'affirmations', label: 'Affirmations', icon: 'sparkles', href: '/affirmations', color: 'journal' },
  { key: 'mind-training', label: 'Mind Training', icon: 'bulb', href: '/mind-training', color: 'primary' },
  { key: 'stretch', label: 'Stretch', icon: 'body', href: '/workout/session/full-body-stretch', color: 'tasks' },
];

export default function AssistantScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { alert: budgetAlert } = useBudgetAlert();
  const { mood, recommendation } = useMoodRecommendation();
  const { details } = useUserDetails();
  const { totalMl, goalMl, addLog } = useWaterDay(todayKey());
  const { totals: foodTotals } = useFoodDay(todayKey());
  const { completedThisWeek } = useWorkoutLogs();
  const { preferences: workoutPreferences } = useWorkoutPreferences();
  const { habits } = useHabits();
  const { trackingEnabled: cycleTrackingEnabled, averageCycleLength, averagePeriodLength } = useCyclePreferences();
  const { logs: cycleLogs } = useCycleLogs();

  const voiceCommands = useMemo<VoiceCommand[]>(() => {
    const topStreak = habits.reduce((best, entry) => (entry.streak > best.streak ? entry : best), { habit: null as (typeof habits)[number]['habit'] | null, streak: 0 });
    return [
      {
        key: 'water',
        patterns: ['log water', 'add water', 'drink water'],
        confirmation: 'Logged 250 milliliters of water',
        run: () => addLog(250),
      },
      {
        key: 'timer',
        patterns: ['start timer', 'start pomodoro', 'focus timer'],
        confirmation: 'Starting your focus timer',
        run: () => router.push({ pathname: '/timer', params: { mode: 'pomodoro' } }),
      },
      {
        key: 'habits',
        patterns: ['open habits', 'show habits'],
        confirmation: 'Opening habits',
        run: () => router.push('/habits'),
      },
      {
        key: 'tasks',
        patterns: ['open tasks', 'show tasks'],
        confirmation: 'Opening tasks',
        run: () => router.push('/tasks'),
      },
      {
        key: 'workout',
        patterns: ['log workout', 'start workout'],
        confirmation: 'Opening workout',
        run: () => router.push('/workout'),
      },
      {
        key: 'meditation',
        patterns: ['start meditation', 'open meditation'],
        confirmation: 'Opening meditation',
        run: () => router.push('/meditation'),
      },
      {
        key: 'finance',
        patterns: ['open finance', 'open wallet'],
        confirmation: 'Opening finance',
        run: () => router.push('/finance'),
      },
      {
        key: 'streak',
        patterns: ["what's my streak", 'whats my streak', 'check my streak', 'my streak'],
        confirmation: topStreak.habit ? `Your best streak is ${topStreak.streak} days, on ${topStreak.habit.name}` : "You don't have an active streak yet",
        run: () => {},
      },
    ];
  }, [habits, addLog, router]);
  const { listening, status, start: startListening } = useVoiceCommands(voiceCommands);

  const goalTip = details?.healthGoal ? GOAL_TIPS[details.healthGoal as HealthGoalKey] : null;
  const financeTip = details?.financialGoals?.[0] ? FINANCE_GOAL_TIPS[details.financialGoals[0] as FinancialGoalKey] : null;
  const effectiveWaterGoal = goalMl === 2000 && details?.weightKg ? suggestedWaterGoalMl(details.weightKg) : goalMl;
  const waterRemaining = Math.max(effectiveWaterGoal - totalMl, 0);

  const recommendedWorkout = useMemo(() => {
    if (!details?.healthGoal || !workoutPreferences) return null;
    const goal = HEALTH_GOAL_TO_WORKOUT_GOAL[details.healthGoal as HealthGoalKey];
    return pickRecommendedWorkout(WORKOUTS, { ...workoutPreferences, goal }, dayOfYear(new Date()));
  }, [details?.healthGoal, workoutPreferences]);

  // Cycle tracking is opt-in and off by default — nothing cycle-related is computed at all unless
  // the user has already turned it on in Cycle Tracking, and even then this is just a light nudge
  // alongside (not instead of) `recommendedWorkout` above. `luteal`/`menstrual` are the phases this
  // app already models as the lower-energy half of the cycle (predictNextPeriod.ts) — there's no
  // finer "early/late luteal" split to key off of, so the whole phase is used as-is.
  const lowEnergyCyclePhase = useMemo(() => {
    if (!cycleTrackingEnabled) return false;
    const phase = predictNextPeriod(cycleLogs, averageCycleLength, averagePeriodLength).currentPhase;
    return phase === 'menstrual' || phase === 'luteal';
  }, [cycleTrackingEnabled, cycleLogs, averageCycleLength, averagePeriodLength]);

  const gentleWorkout = useMemo(() => {
    if (!lowEnergyCyclePhase || !workoutPreferences) return null;
    return pickRecommendedWorkout(WORKOUTS, { ...workoutPreferences, goal: 'flexibility' }, dayOfYear(new Date()));
  }, [lowEnergyCyclePhase, workoutPreferences]);

  const pattern = mood && recommendation ? findPattern(recommendation.breathingPatternKey) : null;
  const session = mood && recommendation ? findSession(recommendation.meditationSessionKey) : null;
  const exercise = mood && recommendation?.mindExerciseKey ? findExercise(recommendation.mindExerciseKey) : null;

  const widgetStat = (key: string): string | null => {
    if (key === 'water') return `${totalMl}/${effectiveWaterGoal} ml`;
    if (key === 'food') return `${foodTotals.calories} cal today`;
    if (key === 'workout') return `${completedThisWeek} this week`;
    return null;
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }} style={{ backgroundColor: theme.colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
        <View style={{ gap: theme.spacing.xs, flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            For You
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            Quick access, and suggestions based on your mood, goals, and budget.
          </Text>
        </View>
        <Pressable
          onPress={startListening}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Listening for a voice command' : 'Speak a voice command'}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: listening ? theme.colors.danger : theme.colors.primary,
          }}>
          <Ionicons name={listening ? 'mic' : 'mic-outline'} size={20} color="#fff" />
        </Pressable>
      </View>

      {listening || status ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Ionicons name={listening ? 'radio-outline' : 'chatbubble-ellipses-outline'} size={18} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>
            {listening ? 'Listening…' : status}
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
          Quick access
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {WIDGETS.map((widget) => {
          const stat = widgetStat(widget.key);
          const color = widget.color === 'primary' ? theme.colors.primary : widget.color === 'journal' ? theme.colors.moduleJournal : theme.colors.moduleTasks;
          const mutedColor = widget.color === 'primary' ? theme.colors.primaryMuted : widget.color === 'journal' ? theme.colors.moduleJournalMuted : theme.colors.moduleTasksMuted;
          return (
            <Pressable key={widget.key} onPress={() => router.push(widget.href as never)} style={{ width: '31%' }}>
              <Card style={{ alignItems: 'center', gap: 6, paddingVertical: theme.spacing.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: mutedColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={widget.icon} size={20} color={color} />
                </View>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                  {widget.label}
                </Text>
                {stat ? <Text style={{ color: theme.colors.textTertiary, fontSize: 10 }}>{stat}</Text> : null}
              </Card>
            </Pressable>
          );
        })}
        </View>
      </View>

      {budgetAlert ? (
        <Pressable onPress={() => router.push('/finance')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.dangerMuted }}>
            <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
              You're at {budgetAlert.percent}% of your {budgetAlert.label} budget
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.danger} />
          </Card>
        </Pressable>
      ) : null}

      {mood && recommendation ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ fontSize: theme.typography.size.lg }}>{moodEmoji(mood)}</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
              {recommendation.message}
            </Text>
          </View>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontStyle: 'italic' }}>
            “{recommendation.affirmation}”
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
          Suggested for you
        </Text>

        {pattern ? (
          <Pressable onPress={() => router.push({ pathname: '/breathing/[patternKey]', params: { patternKey: pattern.key } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Ionicons name="pulse-outline" size={18} color={theme.colors.moduleJournal} />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>{pattern.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>
        ) : null}
        {session ? (
          <Pressable onPress={() => router.push({ pathname: '/meditation/[sessionKey]', params: { sessionKey: session.key } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Ionicons name="moon-outline" size={18} color={theme.colors.moduleJournal} />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>{session.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>
        ) : null}
        {exercise ? (
          <Pressable onPress={() => router.push({ pathname: '/mind-training/[exerciseKey]', params: { exerciseKey: exercise.key } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Ionicons name="bulb-outline" size={18} color={theme.colors.moduleJournal} />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>{exercise.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>
        ) : null}

        <Pressable onPress={() => addLog(250)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="water-outline" size={18} color={theme.colors.moduleTasks} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>
              {waterRemaining > 0 ? `${waterRemaining} ml of water left today — tap to log 250ml` : 'Water goal reached today 🎉'}
            </Text>
          </Card>
        </Pressable>

        {goalTip ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name={goalTip.foodIcon} color={theme.colors.moduleTasks} size="sm" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>{goalTip.foodTip}</Text>
            </View>
            {recommendedWorkout ? (
              <Pressable
                onPress={() => router.push({ pathname: '/workout/[workoutKey]', params: { workoutKey: recommendedWorkout.key } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingTop: theme.spacing.xs, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                <IconBadge name={WORKOUT_GOAL_ICON[recommendedWorkout.goal]} color={theme.colors.moduleTasks} size="sm" />
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>Try: {recommendedWorkout.title}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
              </Pressable>
            ) : goalTip.exerciseCategory ? (
              <Pressable
                onPress={() => router.push({ pathname: '/workout/exercises', params: { category: goalTip.exerciseCategory! } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingTop: theme.spacing.xs, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                <IconBadge name="barbell-outline" color={theme.colors.moduleTasks} size="sm" />
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>
                  Try some {goalTip.exerciseCategory} exercises
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {gentleWorkout ? (
          <Pressable onPress={() => router.push({ pathname: '/workout/[workoutKey]', params: { workoutKey: gentleWorkout.key } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="leaf-outline" color={theme.colors.moduleJournal} size="sm" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>
                Feeling low energy today? Try a gentle recovery session: {gentleWorkout.title}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>
        ) : null}

        {financeTip ? (
          <Pressable onPress={() => router.push(financeTip.link)}>
            <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
              <Ionicons name="cash-outline" size={18} color={theme.colors.moduleTasks} />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>{financeTip.tip}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
