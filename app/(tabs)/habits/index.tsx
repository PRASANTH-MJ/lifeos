import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import * as DocumentPicker from 'expo-document-picker';

import { Card, Chip, EmptyState, FAB_BOTTOM_OFFSET, IconBadge, ImportFormatModal, ProgressBar, ScreenContainer, UpsellModal, showAlert, type ImportFieldSpec } from '@/components';
import { todayKey } from '@/lib/date';
import { readDocumentText } from '@/lib/readDocumentText';
import { useCategories } from '@/modules/categories';
import { HabitListItem, HabitLogSheet, isDueToday, parseHabitsCsv, parseTargetDays, useHabitChains, useHabits } from '@/modules/habits';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { useAppTheme } from '@/theme';

const CSV_MIME_TYPES = ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'];

/** Mirrors exactly what modules/habits/importHabitsCsv.ts reads — keep in sync with that file if
 * its column matching ever changes. */
const HABITS_IMPORT_FIELDS: ImportFieldSpec[] = [
  { column: 'name', aliases: ['habit'], required: true, format: 'Text.', example: 'Drink water' },
  { column: 'icon', required: false, format: 'An Ionicons name (e.g. "water-outline"). Defaults to a generic checkmark icon if blank or unrecognized.', example: 'water-outline' },
  { column: 'category', required: false, format: 'Text — must match one of your existing habit category names (case-insensitive).', example: 'Health' },
  { column: 'frequency', required: false, format: 'One of: daily, weekly, monthly, periodic. Defaults to daily.', example: 'weekly' },
  { column: 'days', aliases: ['weekdays'], required: false, format: 'Comma-separated weekday names/abbreviations, e.g. "Mon,Wed,Fri". Only used when frequency is weekly.', example: 'Mon,Wed,Fri' },
  { column: 'target', required: false, format: 'A number — if present, the habit becomes numeric (e.g. glasses of water) instead of a plain yes/no check-in.', example: '8' },
  { column: 'unit', required: false, format: 'Text — the unit for "target", e.g. "glasses" or "km". Ignored if target is blank.', example: 'glasses' },
  { column: 'group', aliases: ['routinegroup'], required: false, format: 'Free-text grouping label shown as a section on this screen, e.g. "Morning".', example: 'Morning' },
];

type FilterKey = 'all' | number;

/** Compact 2-up dashboard tile — icon+label header, big bold number, thin progress-bar footer.
 * Local to this screen (mirrors the Stitch mobile dashboard's compact stat-tile pattern) rather
 * than a new shared component, since StatCard (the existing shared tile) intentionally doesn't
 * carry an icon header or progress footer. */
function CompactStatTile({
  icon,
  label,
  value,
  progress,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  progress: number;
  color: string;
}) {
  const theme = useAppTheme();
  return (
    <Card style={{ flex: 1, gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <IconBadge name={icon} color={color} size="sm" />
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium, flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
        {value}
      </Text>
      <ProgressBar progress={progress} color={color} height={5} />
    </Card>
  );
}

export default function HabitsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { habits, loading, toggleToday, upsertLog, clearLog, moveHabit, archiveHabit, removeHabit, refresh, createHabit } = useHabits();
  const { chains, loading: chainsLoading } = useHabitChains();
  const { categories } = useCategories('habit');
  const [sheetHabitId, setSheetHabitId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const habitGate = useFreeTierGate('habits');
  const [showUpsell, setShowUpsell] = useState(false);
  const [formatModalVisible, setFormatModalVisible] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapsed = (group: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const onAddHabit = () => {
    if (habitGate.allowed) router.push('/habits-new');
    else setShowUpsell(true);
  };

  const onImportCsv = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: CSV_MIME_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const text = await readDocumentText(result.assets[0]);
    const { rows, total, skipped } = parseHabitsCsv(text, categories);

    if (rows.length === 0) {
      showAlert('Nothing to import', 'No rows had a "name" column. Check your CSV format.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View CSV format', onPress: () => setFormatModalVisible(true) },
      ]);
      return;
    }

    showAlert(
      `Import ${rows.length} habit${rows.length === 1 ? '' : 's'}?`,
      skipped > 0 ? `${skipped} of ${total} rows were skipped (missing name).` : `All ${total} rows matched.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            for (const row of rows) {
              await createHabit(row);
            }
            await refresh();
            showAlert('Imported', `Added ${rows.length} habit${rows.length === 1 ? '' : 's'}.`);
          },
        },
      ]
    );
  };

  const onMenu = () => {
    showAlert('Habits', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'CSV/Excel format', onPress: () => setFormatModalVisible(true) },
      { text: 'Import CSV', onPress: onImportCsv },
    ]);
  };

  // Modal renders as a top-level overlay regardless of which tab is focused, so a sheet left
  // open here would otherwise keep floating over whichever tab you switch to next.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSheetHabitId(null);
        setShowUpsell(false);
      };
    }, [])
  );

  const sheetEntry = habits.find((entry) => entry.habit.id === sheetHabitId);
  const usedCategoryIds = new Set(habits.map((h) => h.habit.category_id).filter((id): id is number => id != null));
  const usedCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  const filteredHabits = filter === 'all' ? habits : habits.filter(({ habit }) => habit.category_id === filter);

  // Ungrouped habits render first, unchanged from before this existed; anything with a
  // routine_group is bucketed into its own collapsible section, in alphabetical order of group
  // name — no habit is forced into a group, and a group only appears if at least one habit uses it.
  const ungroupedHabits = filteredHabits.filter(({ habit }) => !habit.routine_group);
  const groupNames = Array.from(
    new Set(filteredHabits.map(({ habit }) => habit.routine_group).filter((g): g is string => Boolean(g)))
  ).sort((a, b) => a.localeCompare(b));

  // Today's Focus / Perfect Days tiles — derived from the already-loaded `habits` list (no new
  // queries), matching the compact 2-up dashboard-tile pattern used elsewhere.
  const dueTodayHabits = habits.filter(({ habit }) => isDueToday(habit.frequency, parseTargetDays(habit.target_days)));
  const doneTodayCount = dueTodayHabits.filter(({ todayLog }) => todayLog?.status === 'done').length;
  const bestStreak = habits.reduce((max, { streak }) => Math.max(max, streak), 0);

  return (
    <View style={{ flex: 1 }}>
      <ScreenContainer onRefresh={refresh} edges={['top', 'bottom']}>
        <View style={{ gap: theme.spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
                Habits
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, marginTop: 2 }}>
                {habits.length === 0 ? 'Build your first routine' : `${doneTodayCount} of ${dueTodayHabits.length} done today`}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={onMenu} style={{ paddingTop: theme.spacing.xs }}>
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {!loading && habits.length === 0 ? (
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="No habits yet"
              subtitle="Add a daily or weekly habit to start building your streak."
              ctaLabel="Add your first habit"
              onPressCta={onAddHabit}
            />
          ) : (
            <View style={{ gap: theme.spacing.lg }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <CompactStatTile
                  icon="today-outline"
                  label="Today's Focus"
                  value={`${doneTodayCount}/${dueTodayHabits.length}`}
                  progress={dueTodayHabits.length > 0 ? doneTodayCount / dueTodayHabits.length : 0}
                  color={theme.colors.moduleHabits}
                />
                <CompactStatTile
                  icon="flame-outline"
                  label="Best Streak"
                  value={`${bestStreak} ${bestStreak === 1 ? 'day' : 'days'}`}
                  progress={Math.min(bestStreak / 30, 1)}
                  color={theme.colors.warning}
                />
              </View>

              {usedCategories.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
                  <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
                  {usedCategories.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      selected={filter === category.id}
                      color={category.color}
                      onPress={() => setFilter(category.id)}
                    />
                  ))}
                </ScrollView>
              ) : null}

              {ungroupedHabits.length > 0 ? (
                <Card tier="panel" style={{ gap: theme.spacing.sm }}>
                  {ungroupedHabits.map(({ habit, streak, periodProgress, todayLog }) => {
                    const fullIndex = habits.findIndex((h) => h.habit.id === habit.id);
                    return (
                      <HabitListItem
                        key={habit.id}
                        habit={habit}
                        streak={streak}
                        periodProgress={periodProgress}
                        todayLog={todayLog}
                        category={categories.find((c) => c.id === habit.category_id)}
                        onToggle={() => toggleToday(habit)}
                        onOpenLogSheet={() => setSheetHabitId(habit.id)}
                        canMoveUp={filter === 'all' && fullIndex > 0}
                        canMoveDown={filter === 'all' && fullIndex < habits.length - 1}
                        onMoveUp={filter === 'all' ? () => moveHabit(habit.id, 'up') : undefined}
                        onMoveDown={filter === 'all' ? () => moveHabit(habit.id, 'down') : undefined}
                        onArchive={() => archiveHabit(habit.id)}
                        onDelete={() => removeHabit(habit.id)}
                      />
                    );
                  })}
                </Card>
              ) : null}

              {groupNames.map((group) => {
                const groupHabits = filteredHabits.filter(({ habit }) => habit.routine_group === group);
                const collapsed = collapsedGroups.has(group);
                return (
                  <Card key={group} tier="panel" style={{ gap: theme.spacing.sm }}>
                    <Pressable
                      onPress={() => toggleGroupCollapsed(group)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-down'} size={16} color={theme.colors.textSecondary} />
                      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                        {group}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{groupHabits.length}</Text>
                    </Pressable>
                    {!collapsed
                      ? groupHabits.map(({ habit, streak, periodProgress, todayLog }) => {
                          const fullIndex = habits.findIndex((h) => h.habit.id === habit.id);
                          return (
                            <HabitListItem
                              key={habit.id}
                              habit={habit}
                              streak={streak}
                              periodProgress={periodProgress}
                              todayLog={todayLog}
                              category={categories.find((c) => c.id === habit.category_id)}
                              onToggle={() => toggleToday(habit)}
                              onOpenLogSheet={() => setSheetHabitId(habit.id)}
                              canMoveUp={filter === 'all' && fullIndex > 0}
                              canMoveDown={filter === 'all' && fullIndex < habits.length - 1}
                              onMoveUp={filter === 'all' ? () => moveHabit(habit.id, 'up') : undefined}
                              onMoveDown={filter === 'all' ? () => moveHabit(habit.id, 'down') : undefined}
                              onArchive={() => archiveHabit(habit.id)}
                              onDelete={() => removeHabit(habit.id)}
                            />
                          );
                        })
                      : null}
                  </Card>
                );
              })}

              <View style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    Routines
                  </Text>
                  <Link href="/habits/chain-new" asChild>
                    <Pressable accessibilityLabel="New routine" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="add-circle-outline" size={16} color={theme.colors.moduleHabits} />
                      <Text style={{ color: theme.colors.moduleHabits, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                        New routine
                      </Text>
                    </Pressable>
                  </Link>
                </View>
                {!chainsLoading && chains.length > 0 ? (
                  <Card tier="panel" style={{ gap: theme.spacing.sm }}>
                    {chains.map((chain) => (
                      <Link key={chain.id} href={{ pathname: '/habits/chain/[id]', params: { id: String(chain.id) } } as never} asChild>
                        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                          <IconBadge name="link-outline" color={theme.colors.moduleHabits} size="sm" />
                          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }} numberOfLines={1}>
                            {chain.name}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
                        </Pressable>
                      </Link>
                    ))}
                  </Card>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {sheetEntry ? (
          <HabitLogSheet
            visible
            habit={sheetEntry.habit}
            date={todayKey()}
            existingLog={sheetEntry.todayLog}
            onClose={() => setSheetHabitId(null)}
            onSave={(values) => upsertLog(sheetEntry.habit.id, values)}
            onClear={() => clearLog(sheetEntry.habit.id)}
          />
        ) : null}
      </ScreenContainer>

      {!loading && habits.length > 0 ? (
        <Pressable
          onPress={onAddHabit}
          accessibilityLabel="Add habit"
          style={{
            position: 'absolute',
            right: theme.spacing.xl,
            bottom: FAB_BOTTOM_OFFSET,
            width: 56,
            height: 56,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.moduleHabits,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      ) : null}

      <UpsellModal
        visible={showUpsell}
        resourceLabel={LIMIT_LABELS.habits}
        limit={habitGate.limit}
        onClose={() => setShowUpsell(false)}
      />

      <ImportFormatModal
        visible={formatModalVisible}
        onClose={() => setFormatModalVisible(false)}
        title="Habits CSV format"
        intro="Header row required. Column names are case-insensitive."
        fields={HABITS_IMPORT_FIELDS}
      />
    </View>
  );
}
