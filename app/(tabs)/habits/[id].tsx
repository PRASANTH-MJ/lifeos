import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, DonutChart, HeatmapCalendar, IconBadge, Legend, LoadingState, RangeChip, ScreenContainer, SegmentedControl, TrendChart, showAlert } from '@/components';
import { addDays, buildMonthGrid, monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { useCategories } from '@/modules/categories';
import {
  HabitForm,
  HabitLogSheet,
  STREAK_CHALLENGE_TIERS,
  monthlyDoneCounts,
  parseChecklistItems,
  parseTargetDays,
  rangeBounds,
  tallyStatus,
  useHabitDetail,
  useHabits,
  type LogStatus,
  type RangeKey,
} from '@/modules/habits';
import { formatDurationShort, useTimeSpent } from '@/modules/timer';
import { useAppTheme } from '@/theme';

type DetailTab = 'calendar' | 'statistics' | 'edit';

const STATUS_COLOR = (theme: ReturnType<typeof useAppTheme>, status?: LogStatus) =>
  status === 'done' ? theme.colors.success : status === 'fail' ? theme.colors.danger : status === 'skip' ? theme.colors.textTertiary : theme.colors.border;

export default function HabitDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: DetailTab }>();
  const habitId = Number(id);
  const {
    habit,
    logs,
    loading,
    heatmapValues,
    streak,
    longestStreak,
    periodProgress,
    upsertLog,
    clearLog,
    updateHabit,
    archiveHabit,
    deleteHabit,
    restartProgress,
  } = useHabitDetail(habitId);
  const { categories } = useCategories('habit');
  const { habits: allHabits } = useHabits();
  const { totalSeconds: timeSpentTotalSeconds, todaySeconds: timeSpentTodaySeconds } = useTimeSpent({ habitId });
  const existingGroups = Array.from(
    new Set(allHabits.map(({ habit: h }) => h.routine_group).filter((group): group is string => Boolean(group)))
  ).sort((a, b) => a.localeCompare(b));

  const [tab, setTab] = useState<DetailTab>(initialTab ?? 'calendar');
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => monthCursorOf(todayKey()));
  const [statsRange, setStatsRange] = useState<RangeKey>('month');

  const logByDate = useMemo(() => new Map(logs.map((log) => [log.date, log])), [logs]);
  const markedDates = useMemo(() => new Set(logs.map((log) => log.date)), [logs]);

  if (loading || !habit) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const category = categories.find((c) => c.id === habit.category_id);
  const checklistItems = parseChecklistItems(habit.checklist_items);
  const targetDays = parseTargetDays(habit.target_days);
  const logForSheet = sheetDate ? logByDate.get(sheetDate) : undefined;

  const onArchive = () => {
    showAlert('Archive habit?', 'You can still see its history, but it will leave your active list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await archiveHabit();
          router.back();
        },
      },
    ]);
  };

  const onRestart = () => {
    showAlert('Restart progress?', 'This clears all logged history for this habit — streaks and stats start over. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: () => restartProgress() },
    ]);
  };

  const onDelete = () => {
    showAlert('Delete habit?', 'This permanently deletes the habit and all its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteHabit();
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Card tier="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <IconBadge name={habit.icon as never} color={theme.colors.moduleHabits} size="lg" shape="square" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
                {habit.name}
              </Text>
              {category ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name={category.icon as never} size={12} color={category.color} />
                  <Text style={{ color: category.color, fontSize: theme.typography.size.sm }}>{category.name}</Text>
                </View>
              ) : (
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                  {habit.frequency === 'daily' ? 'Daily habit' : habit.frequency === 'periodic' ? 'Periodic habit' : habit.frequency === 'monthly' ? 'Monthly habit' : 'Weekly habit'}
                </Text>
              )}
            </View>
            {habit.frequency === 'periodic' ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                  {periodProgress ?? 0}/{habit.period_target_count}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>this period</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="flame" size={16} color={theme.colors.warning} />
                  <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>{streak}</Text>
                </View>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>streak</Text>
              </View>
            )}
          </Card>

          <Pressable
            onPress={() => router.push({ pathname: '/timer', params: { habitId: String(habit.id), habitTitle: habit.name } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="timer-outline" color={theme.colors.moduleHabits} size="md" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold, flex: 1 }}>
                Focus on this
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>

          {timeSpentTotalSeconds > 0 ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="time-outline" color={theme.colors.moduleHabits} size="md" />
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
                Today: {formatDurationShort(timeSpentTodaySeconds)} · All time: {formatDurationShort(timeSpentTotalSeconds)}
              </Text>
            </Card>
          ) : null}

          {habit.frequency !== 'periodic' ? (
            <Card style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Last 7 days
              </Text>
              <HeatmapCalendar values={heatmapValues} weeks={1} accentColor={theme.colors.moduleHabits} />
            </Card>
          ) : null}

          <SegmentedControl
            options={[
              { value: 'calendar', label: 'Calendar' },
              { value: 'statistics', label: 'Statistics' },
              { value: 'edit', label: 'Edit' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'calendar' ? (
            <CalendarTab
              monthCursor={monthCursor}
              onChangeMonth={(delta) => setMonthCursor((cursor) => shiftMonth(cursor, delta))}
              markedDates={markedDates}
              onSelectDate={setSheetDate}
              streak={streak}
              frequency={habit.frequency}
              logByDate={logByDate}
            />
          ) : null}

          {tab === 'statistics' ? (
            <StatisticsTab
              logs={logs}
              range={statsRange}
              onChangeRange={setStatsRange}
              longestStreak={longestStreak}
              frequency={habit.frequency}
              targetDays={targetDays}
            />
          ) : null}

          {tab === 'edit' ? (
            <HabitForm
              habit={habit}
              submitLabel="Save changes"
              existingGroups={existingGroups}
              onSave={(values) => updateHabit(values)}
              extraActions={
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  <Button label="Restart habit progress" variant="secondary" onPress={onRestart} />
                  <Button label="Archive habit" variant="secondary" onPress={onArchive} />
                  <Button label="Delete habit" variant="danger" onPress={onDelete} />
                </View>
              }
            />
          ) : null}
      </View>

      {sheetDate ? (
        <HabitLogSheet
          visible
          habit={habit}
          date={sheetDate}
          existingLog={logForSheet}
          onClose={() => setSheetDate(null)}
          onSave={(values) => upsertLog(sheetDate, values)}
          onClear={() => clearLog(sheetDate)}
        />
      ) : null}
    </ScreenContainer>
  );
}

function CalendarTab({
  monthCursor,
  onChangeMonth,
  markedDates,
  onSelectDate,
  streak,
  frequency,
  logByDate,
}: {
  monthCursor: { year: number; month: number };
  onChangeMonth: (delta: number) => void;
  markedDates: Set<string>;
  onSelectDate: (dateKey: string) => void;
  streak: number;
  frequency: string;
  logByDate: Map<string, { date: string; status: LogStatus; note: string | null }>;
}) {
  const theme = useAppTheme();
  const today = todayKey();
  const todayLog = logByDate.get(today);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {frequency !== 'periodic' ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="flame" color={theme.colors.warning} size="sm" />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Current streak: {streak} {streak === 1 ? 'day' : 'days'}
          </Text>
        </Card>
      ) : null}

      <Card>
        <CalendarMonthGrid
          year={monthCursor.year}
          month={monthCursor.month}
          selectedDate={today}
          markedDates={markedDates}
          onSelectDate={onSelectDate}
          onChangeMonth={onChangeMonth}
        />
      </Card>

      {todayLog?.note ? (
        <Card style={{ gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Today's note
          </Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{todayLog.note}</Text>
        </Card>
      ) : null}

      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>Tap any date to log it</Text>
    </View>
  );
}

function StatisticsTab({
  logs,
  range,
  onChangeRange,
  longestStreak,
  frequency,
  targetDays,
}: {
  logs: { date: string; status: LogStatus }[];
  range: RangeKey;
  onChangeRange: (range: RangeKey) => void;
  longestStreak: number;
  frequency: string;
  targetDays: number[];
}) {
  const theme = useAppTheme();
  const { start, end } = rangeBounds(range);
  const counts = tallyStatus(logs, start, end);
  const total = counts.done + counts.fail + counts.skip;

  const dotDays =
    range === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(todayKey(), -(6 - i)))
      : range === 'month'
        ? buildMonthGrid(Number(todayKey().split('-')[0]), Number(todayKey().split('-')[1]) - 1).filter((d) => d.startsWith(todayKey().slice(0, 7)))
        : [];

  const logByDate = new Map(logs.map((log) => [log.date, log.status]));
  const barData = monthlyDoneCounts(logs as never, 12);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {(['week', 'month', 'year'] as RangeKey[]).map((key) => (
          <RangeChip key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} selected={range === key} onPress={() => onChangeRange(key)} />
        ))}
      </View>

      {range !== 'year' ? (
        <Card style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {range === 'week' ? 'This week' : 'This month'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {dotDays.map((dateKey) => (
              <View
                key={dateKey}
                style={{
                  width: range === 'week' ? 28 : 16,
                  height: range === 'week' ? 28 : 16,
                  borderRadius: theme.radius.full,
                  backgroundColor: STATUS_COLOR(theme, logByDate.get(dateKey)),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {range === 'week' ? (
                  <Text style={{ color: theme.colors.textPrimary, fontSize: 10 }}>{Number(dateKey.split('-')[2])}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <Card>
          <TrendChart label="Completions per month" data={barData.map((b) => ({ date: b.label, value: b.value }))} color={theme.colors.moduleHabits} />
        </Card>
      )}

      <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          Success vs. fail
        </Text>
        <DonutChart
          segments={[
            { value: counts.done, color: theme.colors.success },
            { value: counts.fail, color: theme.colors.danger },
            { value: counts.skip, color: theme.colors.textTertiary },
          ]}
          centerLabel={total > 0 ? `${Math.round((counts.done / total) * 100)}%` : '—'}
          centerSubLabel="done"
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          <Legend color={theme.colors.success} label={`Done ${counts.done}`} />
          <Legend color={theme.colors.danger} label={`Fail ${counts.fail}`} />
          <Legend color={theme.colors.textTertiary} label={`Skip ${counts.skip}`} />
        </View>
      </Card>

      {frequency !== 'periodic' ? (
        <Card style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Streak challenges
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            {STREAK_CHALLENGE_TIERS.map((tier) => {
              const unlocked = longestStreak >= tier.days;
              return (
                <View
                  key={tier.days}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 4,
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor: unlocked ? theme.colors.warningMuted : theme.colors.background,
                    borderWidth: 1,
                    borderColor: unlocked ? theme.colors.warning : theme.colors.border,
                  }}>
                  <IconBadge
                    name={unlocked ? 'trophy' : 'lock-closed'}
                    color={theme.colors.warning}
                    tone={unlocked ? 'tinted' : 'neutral'}
                    size="sm"
                  />
                  <Text
                    style={{
                      color: unlocked ? theme.colors.textPrimary : theme.colors.textTertiary,
                      fontSize: theme.typography.size.xs,
                      fontWeight: theme.typography.weight.medium,
                      textAlign: 'center',
                    }}>
                    {tier.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

