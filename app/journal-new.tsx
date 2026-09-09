import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, PostToFeedPrompt, ScreenContainer, TextField, UpsellModal, type ShareCardData } from '@/components';
import { formatDisplayDate, monthCursorOf, shiftMonth, toDateKey, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { JOURNAL_PROMPTS, MOODS, MoodPicker, computeWeeklyStreak, useJournal } from '@/modules/journal';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { useAppTheme } from '@/theme';

export default function NewJournalEntryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { entries, createEntry } = useJournal('');
  const journalGate = useFreeTierGate('journalEntries');
  const [showUpsell, setShowUpsell] = useState(false);

  const [prompt, setPrompt] = useState(() => JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]);
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateKey, setDateKey] = useState(todayKey());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(todayKey()));
  // 'share' step shown after saving a brand-new entry — see food-new.tsx's identical
  // savedForShare pattern. Deliberately never includes the entry's own written `body` (private
  // reflective writing, unlike a workout stat) — only the mood + a real weekly streak, mirroring
  // how a habit-streak share card never shows private notes either.
  const [savedForShare, setSavedForShare] = useState<{ card: ShareCardData; streak: number } | null>(null);

  // "New Journal Entry" is a static route — expo-router reuses the same screen instance across
  // repeated visits rather than mounting a fresh one each time, so a plain useState default only
  // resets once, ever. Re-blanking (and re-rolling the prompt) on every focus is what actually
  // makes each visit start fresh.
  useFocusEffect(
    useCallback(() => {
      setPrompt(JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]);
      setBody('');
      setMood(null);
      setDateKey(todayKey());
      setSavedForShare(null);
    }, [])
  );

  const onSave = async () => {
    if (!journalGate.allowed) {
      setShowUpsell(true);
      return;
    }
    setSaving(true);
    await createEntry({ body: body.trim(), mood, prompt, dateKey });
    setSaving(false);
    const streak = computeWeeklyStreak([...entries.map((e) => toDateKey(new Date(e.created_at))), dateKey], todayKey());
    const matchedMood = mood ? MOODS.find((m) => m.key === mood) : null;
    setSavedForShare({
      card: {
        eyebrow: 'JOURNAL',
        value: matchedMood?.emoji ?? '📔',
        valueLabel: matchedMood?.label.toUpperCase() ?? 'ENTRY LOGGED',
        detail: 'Wrote a new journal entry today',
        icon: 'book',
        accentColor: theme.colors.moduleJournal,
      },
      streak,
    });
  };

  if (savedForShare) {
    return (
      <ScreenContainer>
        <View style={{ gap: theme.spacing.xl }}>
          <PostToFeedPrompt
            type="text"
            card={savedForShare.card}
            streak={savedForShare.streak}
            streakLabel="JOURNAL STREAK"
            onDone={() => router.dismissTo('/journal')}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Pressable
          onPress={() => {
            setDateCursor(monthCursorOf(dateKey));
            setDatePickerVisible(true);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
          <Ionicons name="calendar-outline" size={16} color={theme.colors.moduleJournal} />
          <Text style={{ color: theme.colors.moduleJournal, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {dateKey === todayKey() ? 'Today' : formatDisplayDate(dateKey)}
          </Text>
        </Pressable>

        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, fontStyle: 'italic' }}>
          {prompt}
        </Text>

        <MoodPicker value={mood} onChange={setMood} />

        <TextField
          placeholder="Write freely..."
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={8}
          style={{ minHeight: 160, textAlignVertical: 'top' }}
          autoFocus
        />

        <Button label="Save entry" onPress={onSave} disabled={body.trim().length === 0} loading={saving} />
      </View>

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
              selectedDate={dateKey}
              markedDates={new Set([dateKey])}
              onSelectDate={(selected) => {
                setDateKey(selected);
                setDatePickerVisible(false);
              }}
              onChangeMonth={(delta) => setDateCursor((cursor) => shiftMonth(cursor, delta))}
            />
          </View>
        </View>
      </Modal>

      <UpsellModal visible={showUpsell} resourceLabel={LIMIT_LABELS.journalEntries} limit={journalGate.limit} onClose={() => setShowUpsell(false)} />
    </ScreenContainer>
  );
}
