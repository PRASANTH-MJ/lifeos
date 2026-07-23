import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Chip, ScreenContainer } from '@/components';
import { useHabits } from '@/modules/habits';
import { useTimerLogs } from '@/modules/timer';
import { useAppTheme } from '@/theme';

const COUNTDOWN_PRESETS = [5, 10, 15, 20, 30];

export default function TimerScreen() {
  const theme = useAppTheme();
  const { logSession, totalMinutesThisWeek } = useTimerLogs();
  const { habits, upsertLog } = useHabits();
  const timerHabits = habits.filter((entry) => entry.habit.tracking_type === 'timer').map((entry) => entry.habit);

  const [mode, setMode] = useState<'stopwatch' | 'countdown'>('stopwatch');
  const [countdownMinutes, setCountdownMinutes] = useState(10);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    []
  );

  const stop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const start = () => {
    setRunning(true);
    setSaved(false);
    intervalRef.current = setInterval(() => {
      secondsRef.current += 1;
      setElapsed(secondsRef.current);
      if (mode === 'countdown' && secondsRef.current >= countdownMinutes * 60) {
        stop();
      }
    }, 1000);
  };

  const reset = () => {
    stop();
    secondsRef.current = 0;
    setElapsed(0);
    setSaved(false);
  };

  const onSave = async (habitId: number | null) => {
    await logSession(habitId ? timerHabits.find((h) => h.id === habitId)?.name ?? null : null, elapsed, habitId);
    if (habitId) {
      await upsertLog(habitId, { status: 'done', value: Math.round(elapsed / 60) });
    }
    setSaved(true);
  };

  const displaySeconds = mode === 'countdown' ? Math.max(countdownMinutes * 60 - elapsed, 0) : elapsed;
  const minutes = String(Math.floor(displaySeconds / 60)).padStart(2, '0');
  const seconds = String(displaySeconds % 60).padStart(2, '0');

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, gap: theme.spacing.xl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            {totalMinutesThisWeek} min timed this week
          </Text>
        </Card>

        {elapsed === 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Chip label="Stopwatch" selected={mode === 'stopwatch'} onPress={() => setMode('stopwatch')} />
              <Chip label="Countdown" selected={mode === 'countdown'} onPress={() => setMode('countdown')} />
            </View>
            {mode === 'countdown' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {COUNTDOWN_PRESETS.map((minutesOption) => (
                  <Chip
                    key={minutesOption}
                    label={`${minutesOption}m`}
                    selected={countdownMinutes === minutesOption}
                    onPress={() => setCountdownMinutes(minutesOption)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing['2xl'] }}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: 56,
              fontWeight: theme.typography.weight.bold,
              fontVariant: ['tabular-nums'],
            }}>
            {minutes}:{seconds}
          </Text>

          <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
            <Pressable
              onPress={running ? stop : start}
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={running ? 'pause' : 'play'} size={30} color="#fff" />
            </Pressable>
            {elapsed > 0 && !running ? (
              <Pressable
                onPress={reset}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="refresh" size={26} color={theme.colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {elapsed > 0 && !running && !saved ? (
            <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Save this session</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center' }}>
                <Chip label="Just save" onPress={() => onSave(null)} />
                {timerHabits.map((habit) => (
                  <Chip key={habit.id} label={habit.name} onPress={() => onSave(habit.id)} color={theme.colors.moduleHabits} mutedColor={theme.colors.moduleHabitsMuted} />
                ))}
              </View>
            </View>
          ) : null}

          {saved ? <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.sm }}>Saved</Text> : null}
        </View>
      </View>
    </ScreenContainer>
  );
}
