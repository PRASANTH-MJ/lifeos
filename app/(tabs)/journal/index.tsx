import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, IconBadge, ReminderCard, ScreenContainer, TextField, UpsellModal } from '@/components';
import { formatDisplayDate, monthCursorOf, shiftMonth, toDateKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { CheckinSheet, computeWeeklyStreak, JournalListItem, useCheckins, useJournal } from '@/modules/journal';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { useDefaultCheckinReminders, useModuleReminders } from '@/modules/reminders';
import { useAppTheme } from '@/theme';

export default function JournalScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(toDateKey(new Date())));
  const [checkinSheet, setCheckinSheet] = useState<'morning' | 'night' | null>(null);
  const journalGate = useFreeTierGate('journalEntries');
  const [showUpsell, setShowUpsell] = useState(false);
  const { entries, loading, refresh } = useJournal(search);
  const { morning, night, saveMorning, saveNight } = useCheckins();
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders(
    'journal',
    'Time to journal',
    "Write down what's on your mind today."
  );
  const { morning: morningReminder, night: nightReminder } = useDefaultCheckinReminders();

  const heatmapValues = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      const key = toDateKey(new Date(entry.created_at));
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  const weeklyStreak = useMemo(
    () => computeWeeklyStreak(Object.keys(heatmapValues), toDateKey(new Date())),
    [heatmapValues]
  );

  const filteredEntries = dateFilter ? entries.filter((entry) => toDateKey(new Date(entry.created_at)) === dateFilter) : entries;

  // Modal renders as a top-level overlay regardless of which tab is focused, so a sheet left
  // open here would otherwise keep floating over whichever tab you switch to next.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setDatePickerVisible(false);
        setCheckinSheet(null);
        setShowUpsell(false);
      };
    }, [])
  );

  return (
    <View style={{ flex: 1 }}>
    <ScreenContainer onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
              <Pressable
                accessibilityLabel="Browse by date"
                hitSlop={8}
                onPress={() => {
                  setDateCursor(monthCursorOf(dateFilter ?? toDateKey(new Date())));
                  setDatePickerVisible(true);
                }}>
                <Ionicons name="calendar-outline" size={24} color={theme.colors.moduleJournal} />
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() => (journalGate.allowed ? router.push('/journal-new') : setShowUpsell(true))}>
                <Ionicons name="add-circle" size={28} color={theme.colors.moduleJournal} />
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.lg }}>
        {!search && entries.length > 0 ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <IconBadge name="flame" color={theme.colors.moduleJournal} />
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
              {weeklyStreak > 0
                ? `${weeklyStreak} week${weeklyStreak === 1 ? '' : 's'} of journaling in a row`
                : 'Write this week to start a streak'}
            </Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <CheckinButton
            label="Morning check-in"
            icon="sunny"
            done={morning != null}
            color={theme.colors.moduleJournal}
            mutedColor={theme.colors.moduleJournalMuted}
            onPress={() => setCheckinSheet('morning')}
          />
          <CheckinButton
            label="Night check-in"
            icon="moon"
            done={night != null}
            color={theme.colors.moduleJournal}
            mutedColor={theme.colors.moduleJournalMuted}
            onPress={() => setCheckinSheet('night')}
          />
        </View>

        {morningReminder.reminders.map((reminder) => (
          <View key={reminder.id} style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold, textTransform: 'uppercase' }}>
              Morning check-in reminder
            </Text>
            <ReminderCard
              state={reminder}
              onSave={(next) => morningReminder.save(reminder.id, next)}
              onRemove={() => morningReminder.removeReminder(reminder.id)}
              color={theme.colors.moduleJournal}
            />
          </View>
        ))}
        {nightReminder.reminders.map((reminder) => (
          <View key={reminder.id} style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold, textTransform: 'uppercase' }}>
              Night check-in reminder
            </Text>
            <ReminderCard
              state={reminder}
              onSave={(next) => nightReminder.save(reminder.id, next)}
              onRemove={() => nightReminder.removeReminder(reminder.id)}
              color={theme.colors.moduleJournal}
            />
          </View>
        ))}

        {reminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            state={reminder}
            onSave={(next) => saveReminder(reminder.id, next)}
            onRemove={reminders.length > 1 ? () => removeReminder(reminder.id) : undefined}
            color={theme.colors.moduleJournal}
          />
        ))}
        <Button label={reminders.length > 0 ? 'Add another reminder' : 'Add a reminder'} variant="secondary" onPress={addReminder} />

        <TextField placeholder="Search entries" value={search} onChangeText={setSearch} />

        {dateFilter ? (
          <Chip
            label={`${formatDisplayDate(dateFilter)}  ✕`}
            selected
            color={theme.colors.moduleJournal}
            mutedColor={theme.colors.moduleJournalMuted}
            onPress={() => setDateFilter(null)}
          />
        ) : null}

        {!loading && filteredEntries.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title={search ? 'No matching entries' : dateFilter ? 'No entries on this day' : 'No journal entries yet'}
            subtitle={search ? 'Try a different search term.' : dateFilter ? 'Pick another date, or write one now.' : 'Write your first entry to start your history.'}
            ctaLabel={search ? undefined : 'Write an entry'}
            onPressCta={search ? undefined : () => (journalGate.allowed ? router.push('/journal-new') : setShowUpsell(true))}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {filteredEntries.map((entry) => (
              <JournalListItem key={entry.id} entry={entry} />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>

    <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}>
          <CalendarMonthGrid
            year={dateCursor.year}
            month={dateCursor.month}
            selectedDate={dateFilter ?? toDateKey(new Date())}
            markedDates={new Set(Object.keys(heatmapValues))}
            onSelectDate={(selected) => {
              setDateFilter(selected);
              setDatePickerVisible(false);
            }}
            onChangeMonth={(delta) => setDateCursor((cursor) => shiftMonth(cursor, delta))}
          />
        </View>
      </View>
    </Modal>

    <CheckinSheet
      visible={checkinSheet != null}
      type={checkinSheet ?? 'morning'}
      existing={checkinSheet === 'night' ? night : morning}
      onClose={() => setCheckinSheet(null)}
      onSaveMorning={saveMorning}
      onSaveNight={saveNight}
    />

    <UpsellModal visible={showUpsell} resourceLabel={LIMIT_LABELS.journalEntries} limit={journalGate.limit} onClose={() => setShowUpsell(false)} />
    </View>
  );
}

function CheckinButton({
  label,
  icon,
  done,
  color,
  mutedColor,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  done: boolean;
  color: string;
  mutedColor: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ alignItems: 'center', gap: theme.spacing.xs, backgroundColor: done ? mutedColor : theme.colors.surfaceElevated }}>
        <IconBadge name={icon} color={color} tone={done ? 'tinted' : 'neutral'} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold, textAlign: 'center' }}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={done ? color : theme.colors.textTertiary} />
          <Text style={{ color: done ? color : theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {done ? 'Done' : 'Not yet'}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
