import { useCallback, useEffect, useState } from 'react';

import {
  elapsedSecondsFor,
  getActiveSession,
  pauseTracking,
  requestTrackingPermissions,
  resumeTracking,
  startTracking,
  stopTracking,
  type TrackingSession,
} from './locationTracking';
import type { CardioActivity } from './types';

/** Polls the persisted tracking session once a second rather than subscribing to push updates —
 * the session is written by a background TaskManager callback that may run in a separate JS
 * context, so there's no in-process event to subscribe to; AsyncStorage is the only shared
 * channel between that callback and whatever UI happens to be mounted. */
export function useTrackingSession(activity: CardioActivity) {
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionImprecise, setPermissionImprecise] = useState(false);

  const refresh = useCallback(async () => {
    const current = await getActiveSession();
    setSession(current && current.activity === activity ? current : null);
    if (current && current.activity === activity) setElapsedSeconds(elapsedSecondsFor(current));
  }, [activity]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const start = useCallback(async () => {
    const result = await requestTrackingPermissions();
    setPermissionDenied(result === 'denied');
    setPermissionImprecise(result === 'imprecise');
    if (result !== 'granted') return false;
    await startTracking(activity);
    await refresh();
    return true;
  }, [activity, refresh]);

  const pause = useCallback(async () => {
    await pauseTracking();
    await refresh();
  }, [refresh]);

  const resume = useCallback(async () => {
    await resumeTracking();
    await refresh();
  }, [refresh]);

  const finish = useCallback(async () => {
    const result = await stopTracking();
    setSession(null);
    return result;
  }, []);

  return {
    isTracking: session != null,
    status: session?.status ?? null,
    elapsedSeconds,
    distanceKm: session?.distanceKm ?? 0,
    elevationGainM: Math.round(session?.elevationGainM ?? 0),
    points: session?.points ?? [],
    stationary: session?.stationary ?? false,
    permissionDenied,
    permissionImprecise,
    start,
    pause,
    resume,
    finish,
  };
}
