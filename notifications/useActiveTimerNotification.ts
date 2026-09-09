import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ACTIVE_TIMER_NOTIFICATION_ID = 'active-timer-notification';
const ACTIVE_TIMER_CHANNEL_ID = 'active-timer';
const UPDATE_INTERVAL_MS = 15000;

let channelReady = false;

/** A low-importance channel, separate from the "default" one `notifications/setup.ts` creates for
 * plain reminders — this notification is re-presented every ~15s while a timer runs, and reusing
 * `default`'s DEFAULT importance would re-alert (heads-up/sound-eligible) on every single update. */
async function ensureActiveTimerChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(ACTIVE_TIMER_CHANNEL_ID, {
    name: 'Active timer',
    importance: Notifications.AndroidImportance.LOW,
  }).catch(() => {});
  channelReady = true;
}

/** expo-notifications' docs don't guarantee that re-presenting (`trigger: null`) with the same
 * `identifier` replaces an already-shown notification in place — that guarantee is only documented
 * for still-pending *scheduled* notifications. Dismissing first, unconditionally, is the only way
 * to be sure this never stacks duplicates every ~15s while a timer runs. */
async function presentActiveTimerNotification(title: string, body: string): Promise<void> {
  await ensureActiveTimerChannel();
  await Notifications.dismissNotificationAsync(ACTIVE_TIMER_NOTIFICATION_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: ACTIVE_TIMER_NOTIFICATION_ID,
    content: {
      title,
      body,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: Platform.OS === 'android' ? { channelId: ACTIVE_TIMER_CHANNEL_ID } : null,
  }).catch(() => {});
}

export function dismissActiveTimerNotification(): Promise<void> {
  return Notifications.dismissNotificationAsync(ACTIVE_TIMER_NOTIFICATION_ID).catch(() => {});
}

/**
 * Keeps a single fixed-identifier local notification visible with a progress-y title/body while a
 * timer is actively running (Pomodoro focus/break, a workout session, a meditation countdown) — so
 * backgrounding the app mid-session still shows progress, similar to a music player's now-playing
 * notification. Re-presents on a ~15s interval (short enough to feel live, not so frequent it
 * spams) and ALWAYS dismisses on `enabled` going false or on unmount, so a paused/finished/departed
 * timer never leaves a stale notification behind. Native-only — local notifications aren't a
 * meaningful concept on web.
 */
export function useActiveTimerNotification(options: { enabled: boolean; title: string; body: string }): void {
  const { enabled, title, body } = options;
  // Read inside the interval via a ref rather than depending on title/body directly — depending on
  // them would tear down and restart the interval (and re-present immediately) on every tick of a
  // countdown display, which is exactly the "not too frequent" cadence this hook exists to avoid.
  const contentRef = useRef({ title, body });
  contentRef.current = { title, body };

  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return;

    presentActiveTimerNotification(contentRef.current.title, contentRef.current.body);
    const interval = setInterval(() => {
      presentActiveTimerNotification(contentRef.current.title, contentRef.current.body);
    }, UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      dismissActiveTimerNotification();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
