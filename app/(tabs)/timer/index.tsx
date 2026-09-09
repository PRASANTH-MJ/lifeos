import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, GlowSurface, IconBadge, ScreenContainer } from '@/components';
import { useActiveTimerNotification } from '@/notifications/useActiveTimerNotification';
import { useLocalTable } from '@/db';
import { useHabits } from '@/modules/habits';
import { useTaskDetail, type Task } from '@/modules/tasks';
import { useTimerLogs, TimerSessionDetailsModal } from '@/modules/timer';
import { useAppTheme } from '@/theme';

// expo-keep-awake tag scoped to this screen — activating/deactivating under a screen-specific tag
// (rather than the library default) means this timer's keep-awake state can never be accidentally
// cleared by an unrelated activateKeepAwakeAsync()/deactivateKeepAwake() call elsewhere in the app.
const TIMER_KEEP_AWAKE_TAG = 'timer-session-running';

const COUNTDOWN_PRESETS = [5, 10, 15, 20, 30];
const POMODORO_FOCUS_MINUTES = 25;
const POMODORO_BREAK_MINUTES = 5;

export default function TimerScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { taskId, taskTitle, habitId, habitTitle, mode: modeParam } = useLocalSearchParams<{
    taskId?: string;
    taskTitle?: string;
    habitId?: string;
    habitTitle?: string;
    mode?: string;
  }>();
  const { logSession, totalMinutesThisWeek } = useTimerLogs();
  const { habits, upsertLog } = useHabits();
  const timerHabits = habits.filter((entry) => entry.habit.tracking_type === 'timer').map((entry) => entry.habit);

  // "Focus on this" (see app/(tabs)/tasks/[id].tsx and app/(tabs)/habits/[id].tsx) lands here
  // with a taskId/taskTitle OR habitId/habitTitle param — never both. useTaskDetail is safe to
  // call with 0 (no task, see useHabitDetail's identical habits-new.tsx pattern) so this hook can
  // be called unconditionally regardless of whether a task is linked.
  const [taskLinkCleared, setTaskLinkCleared] = useState(false);
  const [habitLinkCleared, setHabitLinkCleared] = useState(false);
  const { task: linkedTask, toggleComplete: toggleLinkedTaskComplete } = useTaskDetail(taskId ? Number(taskId) : 0);
  const effectiveLinkedTask = taskId && !taskLinkCleared ? (linkedTask ?? { id: Number(taskId), title: taskTitle ?? 'Task' }) : null;
  const linkedHabit = habits.find((entry) => entry.habit.id === Number(habitId))?.habit;
  const effectiveLinkedHabit = habitId && !habitLinkCleared ? (linkedHabit ?? { id: Number(habitId), name: habitTitle ?? 'Habit' }) : null;

  const [mode, setMode] = useState<'stopwatch' | 'countdown' | 'pomodoro'>('stopwatch');
  const [countdownMinutes, setCountdownMinutes] = useState(10);
  const [pomodoroPhase, setPomodoroPhase] = useState<'focus' | 'break'>('focus');
  const [pomodoroRounds, setPomodoroRounds] = useState(0);
  const [markTaskDoneOnFinish, setMarkTaskDoneOnFinish] = useState(false);
  const [markHabitDoneOnFinish, setMarkHabitDoneOnFinish] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  // A task or habit landed here via "Focus on this" (taskId/habitId), or a voice command asked
  // for the Pomodoro mode directly (mode=pomodoro, see the /assistant mic — modules/voice),
  // defaults straight into Pomodoro mode — that's the whole point of either entry point — but
  // only once, on mount, so switching modes afterward isn't fought by this effect on every
  // re-render.
  useEffect(() => {
    if (taskId || habitId || modeParam === 'pomodoro') setMode('pomodoro');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    []
  );

  const targetMinutes = mode === 'countdown' ? countdownMinutes : mode === 'pomodoro' ? (pomodoroPhase === 'focus' ? POMODORO_FOCUS_MINUTES : POMODORO_BREAK_MINUTES) : null;

  const stop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // A completed Pomodoro focus phase logs its time automatically (against the linked task/habit
  // when there is one) — unlike the freeform stopwatch/countdown modes, which wait for an
  // explicit Save tap, a 25-minute focus block reaching zero is itself the natural "done" signal.
  // Break phases aren't logged; they're not work being tracked against anything.
  const onPomodoroPhaseComplete = async () => {
    if (pomodoroPhase === 'focus') {
      setPomodoroRounds((count) => count + 1);
      const label = effectiveLinkedTask?.title ?? effectiveLinkedHabit?.name ?? null;
      await logSession(label, secondsRef.current, effectiveLinkedHabit?.id ?? null, effectiveLinkedTask?.id ?? null);
      if (effectiveLinkedTask && markTaskDoneOnFinish) await toggleLinkedTaskComplete();
      if (effectiveLinkedHabit && markHabitDoneOnFinish) {
        await upsertLog(effectiveLinkedHabit.id, { status: 'done' });
      }
    }
  };

  const start = () => {
    setRunning(true);
    setSaved(false);
    intervalRef.current = setInterval(() => {
      secondsRef.current += 1;
      setElapsed(secondsRef.current);
      if (targetMinutes != null && secondsRef.current >= targetMinutes * 60) {
        stop();
        if (mode === 'pomodoro') onPomodoroPhaseComplete();
      }
    }, 1000);
  };

  const reset = () => {
    stop();
    secondsRef.current = 0;
    setElapsed(0);
    setSaved(false);
  };

  const advancePomodoroPhase = () => {
    setPomodoroPhase((phase) => (phase === 'focus' ? 'break' : 'focus'));
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

  const displaySeconds = targetMinutes != null ? Math.max(targetMinutes * 60 - elapsed, 0) : elapsed;
  const minutes = String(Math.floor(displaySeconds / 60)).padStart(2, '0');
  const seconds = String(displaySeconds % 60).padStart(2, '0');
  const pomodoroPhaseComplete = mode === 'pomodoro' && elapsed > 0 && !running && targetMinutes != null && elapsed >= targetMinutes * 60;

  const statusLabel = running
    ? mode === 'pomodoro'
      ? pomodoroPhase === 'focus'
        ? 'Focusing'
        : 'On break'
      : 'Focusing'
    : pomodoroPhaseComplete
      ? pomodoroPhase === 'focus'
        ? 'Focus session done'
        : 'Break’s over'
      : elapsed > 0
        ? 'Paused'
        : 'Ready';

  useActiveTimerNotification({
    enabled: mode === 'pomodoro' && running,
    title: pomodoroPhase === 'focus' ? 'Focus session' : 'Break',
    body: `${minutes}:${seconds} left`,
  });

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, gap: theme.spacing.xl }}>
        <Card tier="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <IconBadge name="time-outline" size="md" />
          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            {totalMinutesThisWeek} min timed this week
          </Text>
        </Card>

        {effectiveLinkedTask ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <IconBadge name="checkbox-outline" color={theme.colors.moduleTasks} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Focusing on</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }} numberOfLines={1}>
                {effectiveLinkedTask.title}
              </Text>
            </View>
            {elapsed === 0 ? (
              <Pressable onPress={() => setTaskLinkCleared(true)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textTertiary} />
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {effectiveLinkedTask ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
              Mark task done when a focus session ends
            </Text>
            <Switch value={markTaskDoneOnFinish} onValueChange={setMarkTaskDoneOnFinish} />
          </View>
        ) : null}

        {effectiveLinkedHabit ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <IconBadge name="flame-outline" color={theme.colors.moduleHabits} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Focusing on</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }} numberOfLines={1}>
                {effectiveLinkedHabit.name}
              </Text>
            </View>
            {elapsed === 0 ? (
              <Pressable onPress={() => setHabitLinkCleared(true)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textTertiary} />
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {effectiveLinkedHabit ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
              Mark habit done when a focus session ends
            </Text>
            <Switch value={markHabitDoneOnFinish} onValueChange={setMarkHabitDoneOnFinish} />
          </View>
        ) : null}

        {elapsed === 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Chip label="Stopwatch" selected={mode === 'stopwatch'} onPress={() => setMode('stopwatch')} />
              <Chip label="Countdown" selected={mode === 'countdown'} onPress={() => setMode('countdown')} />
              <Chip label="Pomodoro" selected={mode === 'pomodoro'} onPress={() => setMode('pomodoro')} />
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
            {mode === 'pomodoro' ? (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {POMODORO_FOCUS_MINUTES}m focus / {POMODORO_BREAK_MINUTES}m break, repeating
                {pomodoroRounds > 0 ? ` · ${pomodoroRounds} focus session${pomodoroRounds === 1 ? '' : 's'} today` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing['2xl'] }}>
          <View
            style={{
              width: 240,
              height: 240,
              borderRadius: theme.radius.full,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xs,
            }}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: 48,
                fontWeight: theme.typography.weight.bold,
                fontVariant: ['tabular-nums'],
              }}>
              {minutes}:{seconds}
            </Text>
            <Text
              style={{
                color: running ? theme.colors.success : theme.colors.textTertiary,
                fontSize: theme.typography.size.sm,
                fontWeight: theme.typography.weight.semibold,
              }}>
              {statusLabel}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xl }}>
            {!pomodoroPhaseComplete ? (
              <GlowSurface borderRadius={theme.radius.full} intensity="md">
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
              </GlowSurface>
            ) : null}
            {elapsed > 0 && !running ? (
              <Pressable
                onPress={reset}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="refresh" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {pomodoroPhaseComplete ? (
            <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
              <Button
                label={pomodoroPhase === 'focus' ? 'Start break' : 'Start next focus'}
                onPress={advancePomodoroPhase}
              />
            </View>
          ) : null}

          {mode !== 'pomodoro' && elapsed > 0 && !running && !saved ? (
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

          {mode !== 'pomodoro' && saved ? <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.sm }}>Saved</Text> : null}
        </View>

        {effectiveLinkedTask ? (
          <Pressable onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: String(effectiveLinkedTask.id) } })}>
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
              Back to task
            </Text>
          </Pressable>
        ) : null}

        {effectiveLinkedHabit ? (
          <Pressable onPress={() => router.push({ pathname: '/habits/[id]', params: { id: String(effectiveLinkedHabit.id) } })}>
            <Text style={{ color: theme.colors.moduleHabits, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
              Back to habit
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
