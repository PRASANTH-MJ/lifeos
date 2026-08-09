import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const TOTAL_TRIALS = 20;

type Direction = 'left' | 'right';

function makeTrial(): { center: Direction; flankers: Direction } {
  const center: Direction = Math.random() < 0.5 ? 'left' : 'right';
  const congruent = Math.random() < 0.5;
  return { center, flankers: congruent ? center : center === 'left' ? 'right' : 'left' };
}

export function FlankerGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [phase, setPhase] = useState<'idle' | 'running' | 'result'>('idle');
  const [trial, setTrial] = useState(makeTrial());
  const [trialsDone, setTrialsDone] = useState(0);
  const [correct, setCorrect] = useState(0);

  const start = () => {
    setTrialsDone(0);
    setCorrect(0);
    setTrial(makeTrial());
    setPhase('running');
  };

  const onAnswer = (direction: Direction) => {
    if (phase !== 'running') return;
    const isCorrect = direction === trial.center;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextDone = trialsDone + 1;
    if (isCorrect) setCorrect(nextCorrect);
    setTrialsDone(nextDone);
    if (nextDone >= TOTAL_TRIALS) {
      setPhase('result');
      onScore(Math.round((nextCorrect / TOTAL_TRIALS) * 100));
      return;
    }
    setTrial(makeTrial());
  };

  const arrowIcon = (dir: Direction) => (dir === 'left' ? 'arrow-back' : 'arrow-forward');

  return (
    <View style={{ flex: 1, gap: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
      {phase === 'running' ? (
        <>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            Which way does the MIDDLE arrow point? — {trialsDone + 1}/{TOTAL_TRIALS}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
            <Ionicons name={arrowIcon(trial.flankers)} size={28} color={theme.colors.textTertiary} />
            <Ionicons name={arrowIcon(trial.flankers)} size={28} color={theme.colors.textTertiary} />
            <Ionicons name={arrowIcon(trial.center)} size={40} color={theme.colors.primary} />
            <Ionicons name={arrowIcon(trial.flankers)} size={28} color={theme.colors.textTertiary} />
            <Ionicons name={arrowIcon(trial.flankers)} size={28} color={theme.colors.textTertiary} />
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <Pressable
              onPress={() => onAnswer('left')}
              style={{ width: 100, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}>
              <Ionicons name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => onAnswer('right')}
              style={{ width: 100, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {phase === 'result' ? (
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {correct}/{TOTAL_TRIALS} correct
            </Text>
          ) : (
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
              Focus on the center arrow only — ignore the ones around it.
            </Text>
          )}
          <Pressable
            onPress={start}
            style={{ paddingHorizontal: theme.spacing['2xl'], paddingVertical: theme.spacing.md, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary }}>
            <Text style={{ color: '#fff', fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              {phase === 'result' ? 'Try again' : 'Start'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
