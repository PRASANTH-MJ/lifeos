import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, ReminderCard, ScreenContainer, TextField, useTabSwipeNavigation } from '@/components';
import { formatDisplayDate, monthCursorOf, shiftMonth, toDateKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { CheckinSheet, computeWeeklyStreak, JournalListItem, useCheckins, useJournal } from '@/modules/journal';
import { useModuleReminders } from '@/modules/reminders';
import { useAppTheme } from '@/theme';

export default function JournalScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const swipeHandlers = useTabSwipeNavigation('/journal');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(toDateKey(new Date())));
  const [checkinSheet, setCheckinSheet] = useState<'morning' | 'night' | null>(null);
  const { entries, loading, refresh } = useJournal(search);
  const { morning, night, saveMorning, saveNight } = useCheckins();
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders(
    'journal',
    'Time to journal',
    "Write down what's on your mind today."
  );

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

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
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
              <Link href="/journal/new" asChild>
                <Pressable hitSlop={8}>
                  <Ionicons name="add-circle" size={28} color={theme.colors.moduleJournal} />
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.lg }}>
        {!search && entries.length > 0 ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Ionicons name="flame" size={22} color={theme.colors.moduleJournal} />
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
            done={morning != null}
            color={theme.colors.moduleJournal}
            mutedColor={theme.colors.moduleJournalMuted}
            onPress={() => setCheckinSheet('morning')}
          />
          <CheckinButton
            label="Night check-in"
            done={night != null}
            color={theme.colors.moduleJournal}
            mutedColor={theme.colors.moduleJournalMuted}
            onPress={() => setCheckinSheet('night')}
          />
        </View>

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
          <Pressable
            onPress={() => setDateFilter(null)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: 6,
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.moduleJournalMuted,
            }}>
            <Text style={{ color: theme.colors.moduleJournal, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              {formatDisplayDate(dateFilter)}
            </Text>
            <Ionicons name="close" size={14} color={theme.colors.moduleJournal} />
          </Pressable>
        ) : null}

        {!loading && filteredEntries.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title={search ? 'No matching entries' : dateFilter ? 'No entries on this day' : 'No journal entries yet'}
            subtitle={search ? 'Try a different search term.' : dateFilter ? 'Pick another date, or write one now.' : 'Write your first entry to start your history.'}
            ctaLabel={search ? undefined : 'Write an entry'}
            onPressCta={search ? undefined : () => router.push('/journal/new')}
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
    </View>
  );
}

function CheckinButton({
  label,
  done,
  color,
  mutedColor,
  onPress,
}: {
  label: string;
  done: boolean;
  color: string;
  mutedColor: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ alignItems: 'center', gap: 4, backgroundColor: done ? mutedColor : theme.colors.surface }}>
        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={color} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
          {label}
        </Text>
      </Card>
    </Pressable>
  );
}
