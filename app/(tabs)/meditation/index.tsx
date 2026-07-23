import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components';
import { MEDITATION_SESSIONS, useMeditationLogs } from '@/modules/meditation';
import { MEDITATION_NUDGE_ID, cancelReminder, requestNotificationPermissions, scheduleDailyReminder } from '@/notifications';
import { useAppTheme } from '@/theme';

export default function MeditationScreen() {
  const theme = useAppTheme();
  const { totalMinutesThisWeek } = useMeditationLogs();
  const [reminderOn, setReminderOn] = useState(false);
  const [updatingReminder, setUpdatingReminder] = useState(false);

  const onToggleReminder = async (value: boolean) => {
    setUpdatingReminder(true);
    if (value) {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleDailyReminder({
          identifier: MEDITATION_NUDGE_ID,
          title: 'Time to breathe',
          body: 'A few quiet minutes are waiting for you.',
          hour: 20,
          minute: 0,
        });
        setReminderOn(true);
      }
    } else {
      await cancelReminder(MEDITATION_NUDGE_ID);
      setReminderOn(false);
    }
    setUpdatingReminder(false);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Ionicons name="time" size={22} color={theme.colors.moduleJournal} />
          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            {totalMinutesThisWeek} min meditated this week
          </Text>
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Ionicons name="notifications" size={20} color={theme.colors.textSecondary} />
          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            Daily reminder at 8:00 PM
          </Text>
          <Switch value={reminderOn} onValueChange={onToggleReminder} disabled={updatingReminder} />
        </Card>

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
      </View>
    </ScreenContainer>
  );
}
