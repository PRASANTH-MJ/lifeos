import { useMemo } from 'react';

import { addDays, todayKey } from '@/lib/date';
import { computeCardioStreak, useCardioLogs } from '@/modules/cardio';
import { useAccounts, useBudgetAlert, useFinanceGoals } from '@/modules/finance';
import { useJournal } from '@/modules/journal';
import { useMindfulnessStreak } from '@/modules/mindfulness';
import { useMindTrainingLogs } from '@/modules/mind-training';
import { computeRelationshipScore, useRelationshipCheckins, useRelationshipPeople } from '@/modules/relationships';
import { useWaterDay } from '@/modules/water';
import { computeWorkoutStreak, useWorkoutLogs } from '@/modules/workout';

import { budgetAdherenceScore, clampScore, ratioScore } from './scoring';

export type LifeScoreArea = 'physical' | 'mental' | 'spiritual' | 'financial' | 'relationship';

export type LifeScore = {
  area: LifeScoreArea;
  label: string;
  score: number;
  detail: string;
};

/** One day of the Life Scoreboard's computed scores, as persisted by useLifeScoreHistory — shared
 * between its native (expo-sqlite) and web (Dexie) builds, neither of which this file imports. */
export type LifeScoreSnapshot = {
  date: string;
  physical: number;
  mental: number;
  spiritual: number;
  financial: number;
  relationship: number;
  overall: number;
};

/**
 * A 1-100 estimate per life area, composed entirely from signals already tracked elsewhere in
 * the app — Physical from cardio/workout/water, Mental from journal/mind training frequency,
 * Spiritual from the combined meditation+breathing streak, Financial from savings-goal progress
 * + budget adherence + net worth trend, Relationship from check-in recency/frequency against the
 * people you've added (see modules/relationships) — the one area that does need its own small bit
 * of data entry, since nothing else in the app tracks family/friend contact.
 *
 * Deliberately not a medical or financial diagnosis — just a rough, honest "where are you
 * putting your attention lately" mirror, framed that way in the UI (see app/(tabs)/scoreboard).
 * Each score is the average of whichever sub-signals actually have data behind them (2-3 each),
 * every ratio-based one itself capped at 100 once a reasonable target is hit (see ratioScore)
 * rather than continuing to reward doing much more than that.
 */
export function useLifeScore(): { scores: LifeScore[]; loading: boolean } {
  const { logs: cardioLogs, loading: cardioLoading } = useCardioLogs();
  const { logs: workoutLogs, completedThisWeek, loading: workoutLoading } = useWorkoutLogs();
  const { totalMl, goalMl, loading: waterLoading } = useWaterDay(todayKey());
  const { entries: journalEntries, loading: journalLoading } = useJournal('');
  const { logs: mindTrainingLogs, loading: mindTrainingLoading } = useMindTrainingLogs();
  const mindfulnessStreak = useMindfulnessStreak();
  const { goals, loading: goalsLoading } = useFinanceGoals();
  const { netWorth, loading: accountsLoading } = useAccounts();
  const { current: budgetStatus, loading: budgetLoading } = useBudgetAlert();
  const { people, loading: peopleLoading } = useRelationshipPeople();
  const { checkins, loading: checkinsLoading } = useRelationshipCheckins();

  const loading =
    cardioLoading ||
    workoutLoading ||
    waterLoading ||
    journalLoading ||
    mindTrainingLoading ||
    goalsLoading ||
    accountsLoading ||
    budgetLoading ||
    peopleLoading ||
    checkinsLoading;

  const scores = useMemo(() => {
    const cutoff14 = addDays(todayKey(), -14);

    // Physical: cardio streak + weekly workout completion + today's water goal.
    const cardioStreak = computeCardioStreak(cardioLogs);
    const workoutStreak = computeWorkoutStreak(workoutLogs);
    const physical = clampScore(
      (ratioScore(cardioStreak, 14) + ratioScore(workoutStreak, 7) + ratioScore(completedThisWeek, 3) + ratioScore(totalMl, goalMl || 2000)) / 4
    );

    // Mental: journal + mind-training frequency over the last two weeks.
    const journalCount14 = journalEntries.filter((e) => e.created_at >= cutoff14).length;
    const mindTrainingCount14 = mindTrainingLogs.filter((l) => l.completed_at >= cutoff14).length;
    const mental = clampScore((ratioScore(journalCount14, 7) + ratioScore(mindTrainingCount14, 5)) / 2);

    // Spiritual: the combined meditation+breathing streak (see useMindfulnessStreak).
    const spiritual = ratioScore(mindfulnessStreak, 14);

    // Financial: average of savings-goal progress, budget adherence, and whether net worth is
    // positive/flat/negative — each only counted when there's real data behind it (no goals set,
    // or no weekly/monthly budget configured, simply drops that term from the average rather than
    // penalizing someone for not having set one up), same "only average what's actually tracked"
    // convention Physical/Mental already follow.
    const activeGoals = goals.filter((g) => !g.is_closed);
    const goalScore =
      activeGoals.length > 0
        ? activeGoals.reduce((sum, g) => sum + ratioScore(g.current_amount, g.target_amount || 1), 0) / activeGoals.length
        : null;
    const budgetScore = budgetStatus ? budgetAdherenceScore(budgetStatus.percent) : null;
    const netWorthScore = netWorth > 0 ? 100 : netWorth === 0 ? 50 : 20;
    const financialTerms = [goalScore, budgetScore, netWorthScore].filter((v): v is number => v != null);
    const financial = clampScore(financialTerms.reduce((sum, v) => sum + v, 0) / financialTerms.length);

    // Relationship: recency + frequency of check-ins logged against the people you've added (see
    // modules/relationships) — replaces the old fixed-50 placeholder that stood in for the
    // removed Accountability Partner signal. Falls back to a neutral 50 only when no people have
    // been added yet at all (see computeRelationshipScore's own doc comment), same honest
    // "nothing to measure yet" convention as everywhere else in this file.
    const relationship = computeRelationshipScore(people, checkins);

    const result: LifeScore[] = [
      { area: 'physical', label: 'Physical Health', score: physical, detail: `${cardioStreak}d cardio streak · ${completedThisWeek} workouts this week` },
      { area: 'mental', label: 'Mental Health', score: mental, detail: `${journalCount14} journal entries · ${mindTrainingCount14} mind-training sessions (14d)` },
      { area: 'spiritual', label: 'Spiritual', score: spiritual, detail: `${mindfulnessStreak}d meditation/breathing streak` },
      {
        area: 'financial',
        label: 'Financial',
        score: financial,
        detail: [
          activeGoals.length > 0 ? `${activeGoals.length} active goal${activeGoals.length === 1 ? '' : 's'}` : null,
          budgetStatus ? `${budgetStatus.percent}% of ${budgetStatus.label} budget used` : null,
          'net worth trend',
        ]
          .filter(Boolean)
          .join(' · '),
      },
      {
        area: 'relationship',
        label: 'Relationship',
        score: relationship,
        detail: people.length > 0 ? `${people.length} ${people.length === 1 ? 'person' : 'people'} tracked` : 'Add people to start tracking',
      },
    ];
    return result;
  }, [
    cardioLogs,
    workoutLogs,
    completedThisWeek,
    totalMl,
    goalMl,
    journalEntries,
    mindTrainingLogs,
    mindfulnessStreak,
    goals,
    netWorth,
    budgetStatus,
    people,
    checkins,
  ]);

  return { scores, loading };
}
