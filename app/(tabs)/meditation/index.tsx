import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, FAB_BOTTOM_OFFSET, LogPastEntryModal, ReminderCard, ScreenContainer } from '@/components';
import { todayKey } from '@/lib/date';
import { MEDITATION_SESSIONS, findSession, useMeditationLogs } from '@/modules/meditation';
import { useModuleReminders } from '@/modules/reminders';
import { useAppTheme } from '@/theme';

export default function MeditationScreen() {
  const theme = useAppTheme();
  const { totalMinutesThisWeek, refresh, logSession } = useMeditationLogs();
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders(
    'meditation',
    'Time to meditate',
    'Take a few minutes to settle your mind.'
  );
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logSessionKey, setLogSessionKey] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(todayKey());

  const onSaveLog = async () => {
    if (!logSessionKey) return;
    const session = findSession(logSessionKey);
    await logSession(logSessionKey, session?.durationSeconds ?? 300, logDate);
    setLogModalVisible(false);
  };

  return (
    <View style={{ flex: 1 }}>
    <ScreenContainer onRefresh={refresh}>
      <View style={{ gap: theme.spacing.xl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Ionicons name="time" size={22} color={theme.colors.moduleJournal} />
          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            {totalMinutesThisWeek} min meditated this week
          </Text>
        </Card>

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

        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            Guided sessions
          </Text>
          {MEDITATION_SESSIONS.map((session) => (
            <Link key={session.key} href={{ pathname: '/meditation/[sessionKey]', params: { sessionKey: session.key } }} asChild>
              <Pressable>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.moduleJournalMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="moon" size={20} color={theme.colors.moduleJournal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                      {session.title}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      {session.description}
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                    {Math.round(session.durationSeconds / 60)} min
                  </Text>
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>

        <Link href="/meditation/timer" asChild>
          <Pressable>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Ionicons name="timer-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                Freeform timer
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>
        </Link>

        <Pressable
          onPress={() => {
            setLogSessionKey(MEDITATION_SESSIONS[0].key);
            setLogDate(todayKey());
            setLogModalVisible(true);
          }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Add calendar entry
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Card>
        </Pressable>
      </View>

      <LogPastEntryModal
        visible={logModalVisible}
        title="Add calendar entry"
        items={MEDITATION_SESSIONS.map((s) => ({ key: s.key, label: s.title }))}
        selectedItemKey={logSessionKey}
        onSelectItem={setLogSessionKey}
        date={logDate}
        onSelectDate={setLogDate}
        onClose={() => setLogModalVisible(false)}
        onSave={onSaveLog}
        moduleColor={theme.colors.moduleJournal}
        moduleMutedColor={theme.colors.moduleJournalMuted}
      />
    </ScreenContainer>

    <Pressable
      onPress={() => {
        setLogSessionKey(MEDITATION_SESSIONS[0].key);
        setLogDate(todayKey());
        setLogModalVisible(true);
      }}
      accessibilityLabel="Add calendar entry"
      style={{
        position: 'absolute',
        right: theme.spacing.xl,
        bottom: FAB_BOTTOM_OFFSET,
        width: 56,
        height: 56,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.moduleJournal,
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
    </View>
  );
}
