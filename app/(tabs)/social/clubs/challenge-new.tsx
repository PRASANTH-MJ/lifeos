import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Chip, ScreenContainer, TextField } from '@/components';
import { addDays, todayKey } from '@/lib/date';
import {
  CHALLENGE_CATEGORIES,
  CHALLENGE_CATEGORY_LABELS,
  CHALLENGE_CATEGORY_METRIC,
  SEASONAL_CHALLENGE_TEMPLATES,
  categoryForMetricType,
  goalUnitLabel,
  useCreateChallenge,
  type ChallengeCategory,
  type ChallengeMetricType,
} from '@/modules/clubs';
import { useAppTheme } from '@/theme';

const DURATION_OPTIONS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

// Only 'activity' has more than one selectable metric — every other category maps 1:1 onto a
// single ChallengeMetricType (see CHALLENGE_CATEGORY_METRIC), since each domain only has one real
// per-user counter to challenge against.
const ACTIVITY_METRIC_OPTIONS: { value: ChallengeMetricType; label: string }[] = [
  { value: 'sessions', label: 'Session count' },
  { value: 'distanceKm', label: 'Total distance (km)' },
  { value: 'habitStreak', label: 'Habit streak' },
];

// What the goal actually counts for each metric, shown under the Goal field so "goal" never reads
// as ambiguous — habitStreak gets its own longer explanation further down instead (it also needs a
// habit name to match), so it's intentionally left out here.
const GOAL_HINT: Partial<Record<ChallengeMetricType, string>> = {
  sessions: 'The number of cardio sessions logged in Fitness.',
  distanceKm: 'The cumulative distance logged across every member, in kilometers.',
  workoutSessions: 'The number of workout sessions logged in Fitness.',
  mealLogs: 'The number of meals logged in Food.',
  waterGoalDays: 'The number of days a member hit their daily water goal.',
  meditationSessions: 'The number of meditation sessions logged.',
  breathingSessions: 'The number of breathing sessions logged.',
};

/** Six challenge categories (workout/food/water/meditation/breathing/activity — see
 * modules/clubs/types.ts's ChallengeCategory), each backed by a real per-user counter already
 * synced onto userPublicProfiles by usePublicProfileStatsSync.ts: workout→workoutLogCount,
 * food→mealLogCount (total logged meals, not a calorie-goal-hit count — there's no such flag in
 * the food module), water→waterGoalHitDays (a best-effort day count, see useWaterGoalHitDays.ts),
 * meditation→meditationLogCount, breathing→breathingLogCount. 'activity' is the original cardio
 * challenge and is the only one with a metric sub-picker (sessions/distance/habit-streak). */
export default function CreateChallengeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { createChallenge, submitting } = useCreateChallenge();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ChallengeCategory>('activity');
  const [metricType, setMetricType] = useState<ChallengeMetricType>('sessions');
  const [goalSessions, setGoalSessions] = useState('10');
  const [targetHabitName, setTargetHabitName] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [teamMode, setTeamMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  const numericGoal = Number(goalSessions);
  const canCreate = title.trim().length > 0 && numericGoal > 0 && (metricType !== 'habitStreak' || targetHabitName.trim().length > 0);

  const selectCategory = (next: ChallengeCategory) => {
    setCategory(next);
    setAppliedTemplateId(null);
    if (next !== 'activity') setMetricType(CHALLENGE_CATEGORY_METRIC[next]);
    else if (metricType !== 'sessions' && metricType !== 'distanceKm' && metricType !== 'habitStreak') setMetricType('sessions');
  };

  /** Fills the form from a seasonal template but leaves everything editable — the admin still
   * reviews and taps Create Challenge themselves, this just saves them typing. Re-picking the same
   * template (or a different one) simply overwrites the fields again. Every seasonal template is
   * cardio-based, so this always lands on the 'activity' category. */
  const applyTemplate = (templateId: string) => {
    const template = SEASONAL_CHALLENGE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const nextMetricType = template.metricType ?? 'sessions';
    setTitle(template.title);
    setDescription(template.description);
    setCategory(categoryForMetricType(nextMetricType));
    setMetricType(nextMetricType);
    setTargetHabitName('');
    setGoalSessions(String(template.goalSessions));
    setDurationDays(template.durationDays);
    setAppliedTemplateId(templateId);
  };

  const onCreate = async () => {
    if (!clubId || !canCreate) return;
    setError(null);
    try {
      const startDate = todayKey();
      const endDate = addDays(startDate, durationDays);
      const challengeId = await createChallenge(clubId, {
        title: title.trim(),
        description: description.trim(),
        metricType,
        goalSessions: numericGoal,
        targetHabitName: metricType === 'habitStreak' ? targetHabitName.trim() : undefined,
        startDate,
        endDate,
        teamMode,
      });
      // push, not replace: this screen is presented as a modal, and replacing it left the
      // challenge screen with no back target — stuck with no way out (see [clubId].tsx's own
      // Link into this same route, which pushes normally and works fine).
      router.push({ pathname: '/social/clubs/challenge', params: { clubId, challengeId } });
    } catch {
      // createChallenge's httpsCallable throws on failure — without this the rejection was
      // unhandled and the button just silently reset with no feedback at all.
      setError('Could not create the challenge. Please try again.');
    }
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
          New Challenge
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Start a seasonal challenge
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            {SEASONAL_CHALLENGE_TEMPLATES.map((template) => (
              <Chip
                key={template.id}
                label={template.name}
                selected={appliedTemplateId === template.id}
                onPress={() => applyTemplate(template.id)}
              />
            ))}
          </View>
          {appliedTemplateId ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Prefilled from a template — edit anything below before creating.
            </Text>
          ) : null}
        </View>

        <TextField
          label="Title"
          placeholder="e.g. 20 runs this month"
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setAppliedTemplateId(null);
          }}
          autoFocus
        />
        <TextField
          label="Description (optional)"
          placeholder="What's this challenge about?"
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            setAppliedTemplateId(null);
          }}
          multiline
        />
        <Card style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              What to track
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {CHALLENGE_CATEGORIES.map((option) => (
                <Chip key={option} label={CHALLENGE_CATEGORY_LABELS[option]} selected={category === option} onPress={() => selectCategory(option)} />
              ))}
            </View>
          </View>

          {category === 'activity' ? (
            <View style={{ gap: theme.spacing.sm, paddingLeft: theme.spacing.sm, borderLeftWidth: 2, borderLeftColor: theme.colors.border }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                Track by
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {ACTIVITY_METRIC_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={metricType === option.value}
                    onPress={() => {
                      setMetricType(option.value);
                      setAppliedTemplateId(null);
                    }}
                  />
                ))}
              </View>
              {metricType === 'habitStreak' ? (
                <TextField
                  label="Habit name to match"
                  placeholder="e.g. No sugar"
                  value={targetHabitName}
                  onChangeText={(text) => {
                    setTargetHabitName(text);
                    setAppliedTemplateId(null);
                  }}
                />
              ) : null}
            </View>
          ) : null}

          <View style={{ gap: theme.spacing.xs }}>
            <TextField
              label={`Goal (${goalUnitLabel(metricType)})`}
              placeholder="10"
              value={goalSessions}
              onChangeText={(text) => {
                setGoalSessions(text);
                setAppliedTemplateId(null);
              }}
              keyboardType="number-pad"
            />
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              {metricType === 'habitStreak'
                ? 'Matches any habit a member has created whose name contains this text (case-insensitive) — members each track their own habit, so exact wording can vary between people.'
                : GOAL_HINT[metricType]}
            </Text>
          </View>
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Duration
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {DURATION_OPTIONS.map((option) => (
              <Chip
                key={option.days}
                label={option.label}
                selected={durationDays === option.days}
                onPress={() => {
                  setDurationDays(option.days);
                  setAppliedTemplateId(null);
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Team mode
          </Text>
          <Chip label="Split into two teams" selected={teamMode} onPress={() => setTeamMode((current) => !current)} />
          {teamMode ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Members are auto-assigned to Team A or Team B as they join, alternating in order — progress is
              compared team-vs-team instead of an individual leaderboard.
            </Text>
          ) : null}
        </View>

        <Button label="Create Challenge" onPress={onCreate} disabled={!canCreate} loading={submitting} glow />
        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs, textAlign: 'center' }}>{error}</Text>
        ) : !canCreate ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
            {!title.trim()
              ? 'Enter a title to continue'
              : metricType === 'habitStreak' && !targetHabitName.trim()
                ? 'Enter a habit name to match'
                : `Enter a ${goalUnitLabel(metricType)} goal to continue`}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
