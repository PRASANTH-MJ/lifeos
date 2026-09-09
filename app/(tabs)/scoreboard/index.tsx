import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Chip, DonutChart, IconBadge, LoadingState, PostToFeedPrompt, ProgressBar, ScreenContainer, Sparkline, type ShareCardData } from '@/components';
import { addDays, formatDisplayDate, todayKey } from '@/lib/date';
import { computeCardioStreak, useCardioLogs } from '@/modules/cardio';
import { useMindfulnessStreak } from '@/modules/mindfulness';
import { useLifeScore, useLifeScoreHistory, WeeklyRecapCard, type LifeScoreArea, type LifeScoreSnapshot } from '@/modules/scoreboard';
import { computeWorkoutStreak, useWorkoutLogs } from '@/modules/workout';
import { useAppTheme } from '@/theme';

const AREA_ICON: Record<LifeScoreArea, keyof typeof Ionicons.glyphMap> = {
  physical: 'walk',
  mental: 'happy-outline',
  spiritual: 'leaf',
  financial: 'cash',
  relationship: 'heart',
};

type SuggestionHref = '/workout' | '/cardio' | '/mind-training' | '/journal' | '/meditation' | '/breathing' | '/finance' | '/relationships';

type Suggestion = { text: string; route: SuggestionHref };

/** Shown once an area's card is expanded — static and hardcoded on purpose, each pointing at the
 * existing screen most likely to move that specific area, not anything dynamically generated. */
const AREA_SUGGESTIONS: Record<LifeScoreArea, Suggestion[]> = {
  physical: [
    { text: 'Log a workout', route: '/workout' },
    { text: 'Track cardio', route: '/cardio' },
  ],
  mental: [
    { text: 'Mind-training', route: '/mind-training' },
    { text: 'Write a journal entry', route: '/journal' },
  ],
  spiritual: [
    { text: 'Meditate', route: '/meditation' },
    { text: 'Breathing session', route: '/breathing' },
  ],
  financial: [{ text: 'Review budget', route: '/finance' }],
  relationship: [{ text: 'Check in with someone', route: '/relationships' }],
};

/** One-line rule-based nudge for the lowest-scoring area — no real AI/LLM behind this, just a
 * static string per area (same honest, non-AI approach as modules/recommendations). */
const AREA_TIP: Record<LifeScoreArea, string> = {
  physical: 'A quick workout or cardio session could lift your Physical score.',
  mental: 'A journal entry or mind-training session could help your Mental score.',
  spiritual: 'A short meditation or breathing session could lift your Spiritual score.',
  financial: 'Reviewing your budget or logging progress toward a goal could help your Financial score.',
  relationship: 'Checking in with someone you care about could lift your Relationship score.',
};

const SUCCESS_THRESHOLD = 70;
const WARNING_THRESHOLD = 40;

function scoreColor(theme: ReturnType<typeof useAppTheme>, score: number): string {
  if (score >= SUCCESS_THRESHOLD) return theme.colors.success;
  if (score >= WARNING_THRESHOLD) return theme.colors.warning;
  return theme.colors.danger;
}

function statusLabel(overall: number): string {
  if (overall >= SUCCESS_THRESHOLD) return 'Thriving';
  if (overall >= WARNING_THRESHOLD) return 'Building Momentum';
  return 'Needs Care';
}

/** Names the highest- and lowest-scoring areas so the hero card's summary sentence is always
 * built from whatever the real scores actually are, never canned copy. */
function buildSummary(scores: { area: LifeScoreArea; label: string; score: number }[]): string {
  if (scores.length === 0) return '';
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best.area === worst.area || best.score === worst.score) {
    return `Your areas are fairly balanced right now, all sitting around ${best.score}.`;
  }
  return `${best.label} is leading the way at ${best.score}, while ${worst.label} could use more attention at ${worst.score}.`;
}

type PillarFilter = 'all' | 'needsCare' | 'thriving';

/** Trailing sparkline + "vs last week" delta for one area, built from its snapshot history —
 * hidden entirely until there's at least a couple of days of history, and the delta only shown
 * once a snapshot from ~7 days ago actually exists (a brand new install has neither). */
function TrendIndicator({ area, color, snapshots }: { area: LifeScoreArea; color: string; snapshots: LifeScoreSnapshot[] }) {
  const theme = useAppTheme();

  if (snapshots.length < 2) return null;

  const series = snapshots.map((snapshot) => ({ date: snapshot.date, value: snapshot[area] }));
  const today = series[series.length - 1];
  const weekAgoDate = addDays(todayKey(), -7);
  const weekAgo = snapshots.find((snapshot) => snapshot.date === weekAgoDate);
  const delta = weekAgo ? today.value - weekAgo[area] : null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Sparkline data={series} color={color} width={56} height={24} />
      {delta != null ? (
        <Text
          style={{
            color: delta === 0 ? theme.colors.textTertiary : delta > 0 ? theme.colors.success : theme.colors.danger,
            fontSize: theme.typography.size.xs,
            fontWeight: theme.typography.weight.semibold,
            minWidth: 36,
            textAlign: 'right',
          }}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)}
        </Text>
      ) : null}
    </View>
  );
}

export default function ScoreboardScreen() {
  const theme = useAppTheme();
  const { scores, loading } = useLifeScore();
  const { snapshots, recordTodaySnapshot } = useLifeScoreHistory();
  const overall = scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0;
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [expandedAreas, setExpandedAreas] = useState<Set<LifeScoreArea>>(new Set());
  const [showShare, setShowShare] = useState(false);

  // The Scoreboard has no real "current streak" of its own — reuse whichever of the app's actual
  // behavior streaks (already surfaced together in WeeklyRecapCard below) is currently longest,
  // rather than inventing one, and hide the badge entirely once all three are at zero.
  const { logs: cardioLogs } = useCardioLogs();
  const { logs: workoutLogs } = useWorkoutLogs();
  const mindfulnessStreak = useMindfulnessStreak();
  const streakOptions: { label: string; value: number }[] = [
    { label: 'cardio', value: computeCardioStreak(cardioLogs) },
    { label: 'workout', value: computeWorkoutStreak(workoutLogs) },
    { label: 'mindfulness', value: mindfulnessStreak },
  ];
  const topStreak = streakOptions.reduce((max, s) => (s.value > max.value ? s : max), streakOptions[0]);

  useEffect(() => {
    if (loading || scores.length === 0) return;
    const byArea = Object.fromEntries(scores.map((s) => [s.area, s.score])) as Record<LifeScoreArea, number>;
    recordTodaySnapshot(byArea, overall);
    // Only re-runs once loading finishes — recordTodaySnapshot itself no-ops if today's row
    // already exists, so this deliberately doesn't depend on `scores`/`overall` changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const weekAgoDate = addDays(todayKey(), -7);
  const weekAgoSnapshot = snapshots.find((snapshot) => snapshot.date === weekAgoDate);
  const overallDelta = weekAgoSnapshot ? overall - weekAgoSnapshot.overall : null;

  const needsCareCount = scores.filter((s) => s.score < WARNING_THRESHOLD).length;
  const thrivingCount = scores.filter((s) => s.score >= SUCCESS_THRESHOLD).length;
  const visibleScores = scores.filter((item) => {
    if (pillarFilter === 'needsCare') return item.score < WARNING_THRESHOLD;
    if (pillarFilter === 'thriving') return item.score >= SUCCESS_THRESHOLD;
    return true;
  });

  const lowestArea = [...scores].sort((a, b) => a.score - b.score)[0];

  const toggleExpanded = (area: LifeScoreArea) => {
    setExpandedAreas((current) => {
      const next = new Set(current);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Scoreboard
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radius.full,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
            }}>
            <Ionicons name="today-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Today · {formatDisplayDate(todayKey())}
            </Text>
          </View>

          {topStreak.value > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: theme.colors.warningMuted,
                borderRadius: theme.radius.full,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
              }}>
              <Ionicons name="flame" size={14} color={theme.colors.warning} />
              <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                {topStreak.value} Day {topStreak.label[0].toUpperCase() + topStreak.label.slice(1)} Streak
              </Text>
            </View>
          ) : null}
        </View>

        <WeeklyRecapCard overall={overall} snapshots={snapshots} />

        <Card tier="elevated" glow style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                color: theme.colors.textTertiary,
                fontSize: theme.typography.size.xs,
                fontWeight: theme.typography.weight.semibold,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}>
              Holistic Pulse
            </Text>
            <Pressable onPress={() => setShowShare(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="share-outline" size={14} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                Share
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
            <DonutChart
              segments={[{ value: overall, color: scoreColor(theme, overall) }, { value: 100 - overall, color: theme.colors.border }]}
              size={112}
              strokeWidth={12}
              centerLabel={String(overall)}
              centerSubLabel="/ 100"
            />
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                  {statusLabel(overall)}
                </Text>
                {overallDelta != null ? (
                  <View
                    style={{
                      backgroundColor: overallDelta >= 0 ? theme.colors.successMuted : theme.colors.dangerMuted,
                      borderRadius: theme.radius.full,
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 2,
                    }}>
                    <Text
                      style={{
                        color: overallDelta > 0 ? theme.colors.success : overallDelta < 0 ? theme.colors.danger : theme.colors.textTertiary,
                        fontSize: theme.typography.size.xs,
                        fontWeight: theme.typography.weight.bold,
                      }}>
                      {overallDelta > 0 ? '+' : ''}
                      {overallDelta} pts vs last week
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{buildSummary(scores)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            <Chip label="All 5 Pillars" selected={pillarFilter === 'all'} onPress={() => setPillarFilter('all')} />
            <Chip
              label={`Needs Care (${needsCareCount})`}
              selected={pillarFilter === 'needsCare'}
              color={theme.colors.danger}
              mutedColor={theme.colors.dangerMuted}
              onPress={() => setPillarFilter('needsCare')}
            />
            <Chip
              label={`Thriving (${thrivingCount})`}
              selected={pillarFilter === 'thriving'}
              color={theme.colors.success}
              mutedColor={theme.colors.successMuted}
              onPress={() => setPillarFilter('thriving')}
            />
          </View>
        </Card>

        {showShare ? (
          <PostToFeedPrompt
            type="text"
            card={
              {
                eyebrow: 'LIFE SCOREBOARD',
                value: String(overall),
                valueLabel: '/ 100',
                detail: statusLabel(overall),
                icon: 'trophy',
                accentColor: scoreColor(theme, overall),
              } satisfies ShareCardData
            }
            onDone={() => setShowShare(false)}
          />
        ) : null}

        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              Life Pillars
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Tap card to expand</Text>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            {visibleScores.map((item) => {
              const color = scoreColor(theme, item.score);
              const expanded = expandedAreas.has(item.area);
              const suggestions = AREA_SUGGESTIONS[item.area];
              return (
                <Pressable key={item.area} onPress={() => toggleExpanded(item.area)}>
                  <Card style={{ gap: theme.spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <IconBadge name={AREA_ICON[item.area]} color={color} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                          {item.label}
                        </Text>
                        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{item.detail}</Text>
                      </View>
                      <TrendIndicator area={item.area} color={color} snapshots={snapshots} />
                      <Text style={{ color, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                        {item.score}
                      </Text>
                      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textTertiary} />
                    </View>
                    <ProgressBar progress={item.score / 100} color={color} height={5} />

                    {expanded && suggestions.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
                        {suggestions.map((suggestion) => (
                          <Link key={suggestion.route} href={suggestion.route} asChild>
                            <Pressable
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                borderWidth: 1,
                                borderColor: theme.colors.border,
                                borderRadius: theme.radius.full,
                                paddingHorizontal: theme.spacing.md,
                                paddingVertical: theme.spacing.xs,
                              }}>
                              <Ionicons name="arrow-forward-circle-outline" size={14} color={color} />
                              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                                {suggestion.text}
                              </Text>
                            </Pressable>
                          </Link>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>

        {lowestArea ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="bulb-outline" color={theme.colors.primary} size="sm" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                Suggestion
              </Text>
            </View>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{AREA_TIP[lowestArea.area]}</Text>
            {AREA_SUGGESTIONS[lowestArea.area].length > 0 ? (
              <Link href={AREA_SUGGESTIONS[lowestArea.area][0].route} asChild>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
                  <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                    {AREA_SUGGESTIONS[lowestArea.area][0].text}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
                </Pressable>
              </Link>
            ) : null}
          </Card>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
