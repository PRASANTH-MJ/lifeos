import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const TOTAL_TRIALS = 15;

type ColorDef = { name: string; hex: string };

function makeTrial(colors: ColorDef[]) {
  const word = colors[Math.floor(Math.random() * colors.length)];
  const ink = colors[Math.floor(Math.random() * colors.length)];
  return { word, ink };
}

export function StroopGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const colors: ColorDef[] = [
    { name: 'Red', hex: theme.colors.danger },
    { name: 'Green', hex: theme.colors.success },
    { name: 'Blue', hex: theme.colors.primary },
    { name: 'Yellow', hex: theme.colors.warning },
  ];

  const [phase, setPhase] = useState<'idle' | 'running' | 'result'>('idle');
  const [trial, setTrial] = useState(makeTrial(colors));
  const [trialsDone, setTrialsDone] = useState(0);
  const [correct, setCorrect] = useState(0);

  const start = () => {
    setTrialsDone(0);
    setCorrect(0);
    setTrial(makeTrial(colors));
    setPhase('running');
  };

  const onPickColor = (colorName: string) => {
    if (phase !== 'running') return;
    const isCorrect = colorName === trial.ink.name;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextDone = trialsDone + 1;
    if (isCorrect) setCorrect(nextCorrect);
    setTrialsDone(nextDone);
    if (nextDone >= TOTAL_TRIALS) {
      const accuracy = Math.round((nextCorrect / TOTAL_TRIALS) * 100);
      setPhase('result');
      onScore(accuracy);
      return;
    }
    setTrial(makeTrial(colors));
  };

  return (
    <View style={{ flex: 1, gap: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
      {phase === 'running' ? (
        <>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            Tap the INK color, not the word — trial {trialsDone + 1}/{TOTAL_TRIALS}
          </Text>
          <Text style={{ color: trial.ink.hex, fontSize: 48, fontWeight: theme.typography.weight.bold }}>{trial.word.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center', width: 260 }}>
            {colors.map((color) => (
              <Pressable
                key={color.name}
                onPress={() => onPickColor(color.name)}
                style={{ width: 116, height: 56, borderRadius: theme.radius.md, backgroundColor: color.hex, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: theme.typography.weight.semibold }}>{color.name}</Text>
              </Pressable>
            ))}
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
              Tap the ink color the word is printed in — ignore what it says.
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
