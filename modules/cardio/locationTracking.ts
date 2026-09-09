import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { isAcceptableAccuracy, isRealisticSpeed, maxSpeedMpsFor, movingAverage } from './gpsFiltering';
import type { CardioActivity } from './types';

export const LOCATION_TASK_NAME = 'cardio-location-tracking';
const SESSION_KEY = 'cardio-tracking-session-v1';

export type TrackingStatus = 'recording' | 'paused';

/** `timestamp` (ms, same epoch as fix.timestamp) is optional — points recorded before this field
 * existed have none, which is exactly what lets splits.ts tell "can compute splits for this log"
 * apart from "can't" (see hasSplitTimestamps there) rather than guessing from a missing/zero value.
 * `accuracy` (meters, expo-location's `coords.accuracy`) is likewise optional — only fixes recorded
 * after accuracy-based filtering was added carry it; every stored point already passed
 * isAcceptableAccuracy before being kept, so this is informational (e.g. for a future "route
 * confidence" display) rather than something downstream code needs to re-check. */
export type RoutePoint = { lat: number; lng: number; timestamp?: number; accuracy?: number };

export type TrackingSession = {
  activity: CardioActivity;
  status: TrackingStatus;
  startedAt: number;
  /** Total milliseconds spent paused so far — subtracted from wall-clock elapsed time so the
   * displayed timer (and the final logged duration) never counts paused time. */
  pausedAccumMs: number;
  pauseStartedAt: number | null;
  lastLat: number | null;
  lastLng: number | null;
  distanceKm: number;
  /** The altitude (meters) the next fix's gain/loss is measured against — not necessarily the
   * very last fix's altitude: a fix that reads as a small down-tick or noise-band wobble leaves
   * this baseline where it was (see the elevation filtering in the location task below), so gain
   * only ever accumulates from real upward climbs, not GPS jitter. Null right after start/resume,
   * same as lastLat/lastLng, so the first fix after either establishes a fresh baseline instead of
   * measuring a "gain" across a gap that was never actually climbed. */
  lastAltitude: number | null;
  /** Cumulative sum of accepted upward altitude deltas — see MIN_ALTITUDE_DELTA_METERS. */
  elevationGainM: number;
  /** Rolling window of the last few *raw* altitude fixes (meters), oldest first, capped at
   * ALTITUDE_SMOOTHING_WINDOW — averaged via movingAverage() to produce a smoothed altitude
   * before it's compared against lastAltitude for gain purposes, so a single noisy altitude fix
   * can't swing the gain total on its own. Reset alongside lastAltitude on resume. */
  altitudeBuffer: number[];
  /** Every accepted GPS fix in order, for drawing the route on CardioRouteMap — unlike the
   * distance calculation, this isn't filtered by MIN/MAX_SAMPLE_METERS, so a short pause with
   * tiny movement still draws a (slightly noisy) continuous line rather than a gap. */
  points: RoutePoint[];
  /** The timestamp (ms) of the last fix a speed was measured from — separate from `points`, which
   * only stores lat/lng, and reset alongside lastLat/lastLng on resume so a post-resume speed
   * reading is never measured across the paused gap. */
  lastFixTimestamp: number | null;
  /** Rolling window of the last few fixes' instantaneous speed (m/s), oldest first, capped at
   * STATIONARY_SAMPLE_COUNT — see isStationaryNow below. */
  recentSpeedsMps: number[];
  /** True once the last STATIONARY_SAMPLE_COUNT fixes have all read below STATIONARY_SPEED_MPS —
   * distance/elapsed-active-time accumulation pauses while this is true (see the location task
   * below and elapsedSecondsFor), without stopping GPS point recording itself. Cleared the moment
   * a single fix reads back above the threshold. */
  stationary: boolean;
  /** Total milliseconds spent auto-paused (stationary) so far — subtracted from wall-clock elapsed
   * time the same way pausedAccumMs is, so the displayed timer doesn't advance while stationary
   * either, not just distance. */
  stationaryAccumMs: number;
  stationaryStartedAt: number | null;
};

/** Below this, a GPS fix's "movement" is almost certainly just positional jitter, not real
 * travel — skip it entirely rather than let it slowly inflate distance while stationary. Above
 * the upper bound, it's almost certainly a bad fix (signal bounce, cold-start jump) — skip that
 * too rather than let one bad sample add a fake kilometer. */
const MIN_SAMPLE_METERS = 3;
const MAX_SAMPLE_METERS = 300;

/** GPS-derived altitude is noisy enough that even standing still drifts by a meter or so between
 * fixes — below this, a delta is treated as noise and the baseline simply isn't moved, so the
 * jitter can't slowly accumulate into fake gain over a long session. Above the upper bound, it's
 * almost certainly a bad altitude fix (the same reasoning as MAX_SAMPLE_METERS for distance) — the
 * baseline still resets to it (so one bad fix doesn't poison every future delta), it's just not
 * counted as real gain. */
const MIN_ALTITUDE_DELTA_METERS = 1;
const MAX_ALTITUDE_DELTA_METERS = 50;

/** Trailing window (fix count) averaged via movingAverage() before altitude deltas are measured
 * — smooths GPS altitude noise out of the elevation gain total without needing raw altitude for
 * anything else (there's no live raw-altitude display today). */
const ALTITUDE_SMOOTHING_WINDOW = 5;

/** Below this instantaneous speed, a fix reads as "standing still" (a red light, a stopped
 * break) rather than genuinely slow movement — comfortably below even a slow walk (~1.2 m/s), so
 * this doesn't false-trigger on someone just taking it easy. */
const STATIONARY_SPEED_MPS = 0.3;
/** How many consecutive low-speed fixes are required before auto-pausing — at the location task's
 * ~4s fix interval, 2 fixes is ~8s of sustained stillness, mirroring Strava-style auto-pause
 * (triggers within a several-second window) without needing a whole new fix-interval constant. */
const STATIONARY_SAMPLE_COUNT = 2;

/** Exported for splits.ts, which needs the same great-circle distance math to walk a saved route's
 * points rather than duplicating it. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getSession(): Promise<TrackingSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as TrackingSession) : null;
}

async function setSession(session: TrackingSession | null): Promise<void> {
  if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else await AsyncStorage.removeItem(SESSION_KEY);
}

// Registered at module scope — required by expo-task-manager so the OS can invoke it even when
// the app was relaunched into a background JS context (e.g. after being killed and restarted by
// the OS to deliver a location update). Every session field this reads/writes goes through
// AsyncStorage rather than component state, since this callback runs independently of whatever
// (if anything) is currently mounted.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const fix = locations?.[locations.length - 1];
  if (!fix) return;

  // Horizontal accuracy above MAX_ACCURACY_METERS means this fix is likely a "jumped through a
  // building" spike — reject it wholesale before it touches the route, distance, or elevation,
  // rather than trying to salvage any part of it. The device will report another fix in a few
  // seconds; nothing about this one is worth keeping.
  if (!isAcceptableAccuracy(fix.coords.accuracy)) return;

  const session = await getSession();
  if (!session || session.status !== 'recording') return;
  // A session persisted before these fields existed (an in-progress recording carried across an
  // app update) would otherwise read as `undefined` here, turning every `+=`/array op into NaN
  // or a crash.
  session.elevationGainM = session.elevationGainM ?? 0;
  session.altitudeBuffer = session.altitudeBuffer ?? [];
  session.recentSpeedsMps = session.recentSpeedsMps ?? [];
  session.stationary = session.stationary ?? false;
  session.stationaryAccumMs = session.stationaryAccumMs ?? 0;
  session.stationaryStartedAt = session.stationaryStartedAt ?? null;

  const fixTimestamp = fix.timestamp ?? Date.now();
  const meters =
    session.lastLat != null && session.lastLng != null
      ? haversineKm(session.lastLat, session.lastLng, fix.coords.latitude, fix.coords.longitude) * 1000
      : null;
  const dtSeconds = session.lastFixTimestamp != null ? (fixTimestamp - session.lastFixTimestamp) / 1000 : null;
  // A fix implying a physically-unrealistic speed for this activity (a bad fix bouncing off a
  // building, a cold-start jump) shouldn't count as real movement for distance purposes — see
  // isRealisticSpeed. Two fixes with no time between them (dtSeconds <= 0, a duplicate delivery)
  // are equally untrustworthy and read as "not realistic" too.
  const realisticSpeed = meters != null && dtSeconds != null ? isRealisticSpeed(meters, dtSeconds, maxSpeedMpsFor(session.activity)) : true;

  // Speed is measured off the raw distance/time between fixes, not the MIN/MAX_SAMPLE_METERS-
  // filtered value used for distance below — a fix filtered out as "too small to count" (pure
  // jitter) is exactly the signal that the device hasn't actually moved, which is what the
  // stationary check needs to see.
  if (meters != null && dtSeconds != null && dtSeconds > 0) {
    const speedMps = meters / dtSeconds;
    if (speedMps >= STATIONARY_SPEED_MPS) {
      // A single fix back above the threshold is enough to resume — no reason to make someone
      // wait out a whole new window before the numbers start moving again.
      session.recentSpeedsMps = [];
      session.stationary = false;
    } else {
      session.recentSpeedsMps = [...session.recentSpeedsMps, speedMps].slice(-STATIONARY_SAMPLE_COUNT);
      if (session.recentSpeedsMps.length >= STATIONARY_SAMPLE_COUNT) session.stationary = true;
    }
  }

  if (session.stationary) {
    if (session.stationaryStartedAt == null) session.stationaryStartedAt = fixTimestamp;
  } else if (session.stationaryStartedAt != null) {
    session.stationaryAccumMs += fixTimestamp - session.stationaryStartedAt;
    session.stationaryStartedAt = null;
  }

  if (meters != null && meters >= MIN_SAMPLE_METERS && meters <= MAX_SAMPLE_METERS && !session.stationary && realisticSpeed) {
    session.distanceKm += meters / 1000;
  }
  session.lastLat = fix.coords.latitude;
  session.lastLng = fix.coords.longitude;
  session.lastFixTimestamp = fixTimestamp;

  const altitude = fix.coords.altitude;
  if (altitude != null) {
    // Smooth the raw altitude series (a moving average over the last ALTITUDE_SMOOTHING_WINDOW
    // fixes) before it's compared against the baseline — GPS altitude is noisy enough that a
    // single fix can wobble a meter or more even standing still, which otherwise slowly inflates
    // the gain total over a long session.
    session.altitudeBuffer = [...session.altitudeBuffer, altitude].slice(-ALTITUDE_SMOOTHING_WINDOW);
    const smoothedAltitude = movingAverage(session.altitudeBuffer, ALTITUDE_SMOOTHING_WINDOW);
    if (session.lastAltitude != null) {
      const delta = smoothedAltitude - session.lastAltitude;
      if (delta >= MIN_ALTITUDE_DELTA_METERS && delta <= MAX_ALTITUDE_DELTA_METERS) {
        session.elevationGainM += delta;
        session.lastAltitude = smoothedAltitude;
      } else if (delta < -MIN_ALTITUDE_DELTA_METERS || delta > MAX_ALTITUDE_DELTA_METERS) {
        // A real descent, or a fix bad enough to ignore for gain purposes either way — reset the
        // baseline to it so the next fix's delta is measured from here, not left stale.
        session.lastAltitude = smoothedAltitude;
      }
      // Else: within the noise band — leave the baseline where it was.
    } else {
      session.lastAltitude = smoothedAltitude;
    }
  }

  session.points = [
    ...(session.points ?? []),
    { lat: fix.coords.latitude, lng: fix.coords.longitude, timestamp: fixTimestamp, accuracy: fix.coords.accuracy ?? undefined },
  ];
  await setSession(session);
});

export type TrackingPermissionResult = 'granted' | 'denied' | 'imprecise';

/** Android 12+ lets a user grant location while only picking "Approximate" instead of "Precise"
 * — `requestForegroundPermissionsAsync()` still resolves `granted: true` either way, so without
 * this check the app has no way to tell "permission denied" apart from "permission granted but
 * useless for GPS tracking": the coarse/approximate provider doesn't deliver the dense, accurate
 * fixes `BestForNavigation` needs, so distance would silently stay near zero the whole session
 * even though the user did "enable location." iOS has an equivalent 'reduced' accuracy authorization
 * (`foreground.ios?.accuracy`), included here for parity even though this feature is Android-only
 * today. */
export async function requestTrackingPermissions(): Promise<TrackingPermissionResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return 'denied';
  if (foreground.android?.accuracy === 'coarse' || foreground.ios?.accuracy === 'reduced') return 'imprecise';
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted ? 'granted' : 'denied';
}

export async function startTracking(activity: CardioActivity): Promise<void> {
  const session: TrackingSession = {
    activity,
    status: 'recording',
    startedAt: Date.now(),
    pausedAccumMs: 0,
    pauseStartedAt: null,
    lastLat: null,
    lastLng: null,
    distanceKm: 0,
    lastAltitude: null,
    altitudeBuffer: [],
    elevationGainM: 0,
    points: [],
    lastFixTimestamp: null,
    recentSpeedsMps: [],
    stationary: false,
    stationaryAccumMs: 0,
    stationaryStartedAt: null,
  };
  await setSession(session);
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 4000,
    distanceInterval: 8,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Flowsy is tracking your activity',
      notificationBody: 'Recording distance and time in the background.',
    },
  });
}

export async function pauseTracking(): Promise<void> {
  const session = await getSession();
  if (!session || session.status === 'paused') return;
  session.status = 'paused';
  session.pauseStartedAt = Date.now();
  await setSession(session);
}

export async function resumeTracking(): Promise<void> {
  const session = await getSession();
  if (!session || session.status === 'recording') return;
  session.pausedAccumMs += session.pauseStartedAt ? Date.now() - session.pauseStartedAt : 0;
  session.pauseStartedAt = null;
  session.status = 'recording';
  // The next fix after a resume shouldn't measure distance (or elevation gain) across the paused
  // gap (the user may have moved/climbed without that counting, or simply been stationary) —
  // treat it as a fresh start point instead of continuing either calculation from the last
  // pre-pause fix.
  session.lastLat = null;
  session.lastLng = null;
  session.lastAltitude = null;
  session.altitudeBuffer = [];
  session.lastFixTimestamp = null;
  session.recentSpeedsMps = [];
  // If the user manually resumes while auto-paused (stationary), that's an explicit "I'm moving
  // again" signal — clear it immediately rather than waiting for a fresh window of fast fixes,
  // and fold whatever time was spent stationary into the accumulator like a normal auto-resume.
  if (session.stationaryStartedAt != null) {
    session.stationaryAccumMs = (session.stationaryAccumMs ?? 0) + (Date.now() - session.stationaryStartedAt);
    session.stationaryStartedAt = null;
  }
  session.stationary = false;
  await setSession(session);
}

export async function stopTracking(): Promise<{ distanceKm: number; elapsedSeconds: number; points: RoutePoint[]; elevationGainM: number } | null> {
  const session = await getSession();
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  await setSession(null);
  if (!session) return null;
  return {
    distanceKm: session.distanceKm,
    elapsedSeconds: elapsedSecondsFor(session),
    points: session.points ?? [],
    elevationGainM: Math.round(session.elevationGainM ?? 0),
  };
}

export function elapsedSecondsFor(session: TrackingSession): number {
  const pausedMs = session.pausedAccumMs + (session.status === 'paused' && session.pauseStartedAt ? Date.now() - session.pauseStartedAt : 0);
  const stationaryMs =
    (session.stationaryAccumMs ?? 0) + (session.stationary && session.stationaryStartedAt ? Date.now() - session.stationaryStartedAt : 0);
  return Math.max(0, Math.floor((Date.now() - session.startedAt - pausedMs - stationaryMs) / 1000));
}

export async function getActiveSession(): Promise<TrackingSession | null> {
  return getSession();
}
