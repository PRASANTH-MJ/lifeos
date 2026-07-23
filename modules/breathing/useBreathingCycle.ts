import { useCallback, useEffect, useRef, useState } from 'react';

import type { BreathingPattern } from './types';

/**
 * Drives a breathing pattern's step/cycle timing off a mutable ref (not state)
 * so each 1s tick reads-and-writes synchronously — avoids the stale-closure
 * races you'd get chaining multiple `setState` updaters across a step boundary.
 */
export function useBreathingCycle(pattern: BreathingPattern, targetCycles: number, onFinish: (totalSeconds: number) => void) {
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(pattern.steps[0].seconds);
  const [cycles, setCycles] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef({ stepIndex: 0, secondsLeft: pattern.steps[0].seconds, cycles: 0, totalSeconds: 0 });

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const s = stateRef.current;
    s.totalSeconds += 1;
    if (s.secondsLeft > 1) {
      s.secondsLeft -= 1;
    } else {
      s.stepIndex = (s.stepIndex + 1) % pattern.steps.length;
      s.secondsLeft = pattern.steps[s.stepIndex].seconds;
      if (s.stepIndex === 0) {
        s.cycles += 1;
      }
    }

    setStepIndex(s.stepIndex);
    setSecondsLeft(s.secondsLeft);
    setCycles(s.cycles);
    setTotalSeconds(s.totalSeconds);

    if (s.cycles >= targetCycles) {
      stop();
      onFinish(s.totalSeconds);
    }
  }, [pattern, targetCycles, onFinish, stop]);

  const start = useCallback(() => {
    setRunning(true);
    intervalRef.current = setInterval(tick, 1000);
  }, [tick]);

  const reset = useCallback(() => {
    stop();
    stateRef.current = { stepIndex: 0, secondsLeft: pattern.steps[0].seconds, cycles: 0, totalSeconds: 0 };
    setStepIndex(0);
    setSecondsLeft(pattern.steps[0].seconds);
    setCycles(0);
    setTotalSeconds(0);
  }, [pattern, stop]);

  useEffect(() => stop, [stop]);

  return { step: pattern.steps[stepIndex], secondsLeft, cycles, totalSeconds, running, start, stop, reset };
}
