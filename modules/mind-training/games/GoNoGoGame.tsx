import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const TOTAL_TRIALS = 15;
const TRIAL_MS = 900;
const GAP_MS = 400;
const GO_PROBABILITY = 0.7;

type TrialType = 'go' | 'no-go';

export function GoNoGoGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [phase, setPhase] = useState<'idle' | 'running' | 'blank' | 'result'>('idle');
  const [currentTrial, setCurrentTrial] = useState<TrialType | null>(null);
  const [trialsDone, setTrialsDone] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const runRef = useRef({ trials: [] as TrialType[], index: 0, tapped: false, correct: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const nextTrial = () => {
    const run = runRef.current;
    if (run.index >= run.trials.length) {
      const acc = Math.round((run.correct / run.trials.length) * 100);
      setAccuracy(acc);
      setPhase('result');
      onScore(acc);
      return;
    }

    const trial = run.trials[run.index];
    run.tapped = false;
    setCurrentTrial(trial);
    setPhase('running');

    timeoutRef.current = setTimeout(() => {
      const correct = trial === 'go' ? run.tapped : !run.tapped;
      if (correct) run.correct += 1;
      run.index += 1;
      setTrialsDone(run.index);
      setCurrentTrial(null);
      setPhase('blank');
      timeoutRef.current = setTimeout(nextTrial, GAP_MS);
    }, TRIAL_MS);
  };

  const start = () => {
    runRef.current = {
      trials: Array.from({ length: TOTAL_TRIALS }, () => (Math.random() < GO_PROBABILITY ? 'go' : 'no-go')),
      index: 0,
      tapped: false,
      correct: 0,
    };
    setAccuracy(null);
    setTrialsDone(0);
    nextTrial();
  };

  const onTapArea = () => {
    if (phase === 'idle' || phase === 'result') {
      start();
      return;
    }
    if (phase === 'running') {
      runRef.current.tapped = true;
    }
  };

  const backgroundColor =
    phase === 'running' ? (currentTrial === 'go' ? theme.colors.success : theme.colors.danger) : theme.colors.surface;

  const label =
    phase === 'idle'
      ? 'Tap to start'
      : phase === 'result'
        ? `${accuracy}% accuracy — tap to retry`
        : `Trial ${Math.min(trialsDone + 1, TOTAL_TRIALS)} / ${TOTAL_TRIALS}`;

  return (
    <Pressable
      onPress={onTapArea}
      style={{ flex: 1, borderRadius: theme.radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor, gap: theme.spacing.md }}>
      {phase === 'running' ? (
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff', opacity: 0.25 }} />
      ) : null}
      <Text
        style={{
          fontSize: theme.typography.size.lg,
          fontWeight: theme.typography.weight.bold,
          color: phase === 'running' ? '#fff' : theme.colors.textPrimary,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
