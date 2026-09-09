import { useCallback, useEffect, useRef, useState } from 'react';

/** A pause-resumable countdown to `durationSeconds`, shared by the guided session player and the
 * freeform timer so both get identical tick/pause/complete behavior (and, via CountdownDisplay,
 * identical progress-bar UI) instead of each hand-rolling its own setInterval. `completedAt`
 * increments (rather than a plain boolean) each time the countdown reaches its duration on its
 * own — react to it with a `useEffect([completedAt])` rather than passing an onComplete callback
 * in, since the callback would usually want to close over this hook's own return values (elapsed,
 * pause), which don't exist yet at the point the hook itself is called. */
export function useCountdownSession(durationSeconds: number) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [completedAt, setCompletedAt] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const pause = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed((current) => {
        const next = current + 1;
        if (next >= durationSeconds) {
          pause();
          setCompletedAt((count) => count + 1);
          return durationSeconds;
        }
        return next;
      });
    }, 1000);
  }, [durationSeconds, pause]);

  return { elapsed, running, start, pause, completedAt };
}
