import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const DIGIT_MS = 700;
const PAUSE_BEFORE_NEXT_ROUND_MS = 700;

export function DigitSpanGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'gameover'>('idle');
  const [shownDigit, setShownDigit] = useState<number | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => clearTimeouts, []);

  const playback = (seq: number[]) => {
    setPhase('showing');
    setShownDigit(null);
    seq.forEach((digit, i) => {
      timeoutsRef.current.push(setTimeout(() => setShownDigit(digit), i * DIGIT_MS));
      timeoutsRef.current.push(setTimeout(() => setShownDigit(null), i * DIGIT_MS + DIGIT_MS * 0.6));
    });
    timeoutsRef.current.push(
      setTimeout(() => {
        setPhase('input');
        setUserInput([]);
      }, seq.length * DIGIT_MS)
    );
  };

  const start = () => {
    clearTimeouts();
    const first = [Math.floor(Math.random() * 10)];
    setSequence(first);
    playback(first);
  };

  const onDigitPress = (digit: number) => {
    if (phase !== 'input') return;
    const nextInput = [...userInput, digit];
    const expected = sequence[nextInput.length - 1];
    if (digit !== expected) {
      clearTimeouts();
      onScore(sequence.length - 1);
      setPhase('gameover');
      return;
    }
    if (nextInput.length === sequence.length) {
      const grown = [...sequence, Math.floor(Math.random() * 10)];
      setSequence(grown);
      timeoutsRef.current.push(setTimeout(() => playback(grown), PAUSE_BEFORE_NEXT_ROUND_MS));
    } else {
      setUserInput(nextInput);
    }
  };

  const statusLabel = {
    idle: 'Tap Start to begin',
    showing: 'Watch the digits…',
    input: `Recall ${sequence.length} digit${sequence.length === 1 ? '' : 's'} — (${userInput.length}/${sequence.length})`,
    gameover: `Game over — reached ${Math.max(sequence.length - 1, 0)} digits`,
  }[phase];

  return (
    <View style={{ flex: 1, gap: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
        {statusLabel}
      </Text>

      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'showing' && shownDigit !== null ? (
          <Text style={{ color: theme.colors.primary, fontSize: 56, fontWeight: theme.typography.weight.bold }}>{shownDigit}</Text>
        ) : null}
      </View>

      {phase === 'input' ? (
        <View style={{ width: 260, flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center' }}>
          {Array.from({ length: 10 }, (_, digit) => (
            <Pressable
              key={digit}
              onPress={() => onDigitPress(digit)}
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.semibold }}>
                {digit}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {phase === 'idle' || phase === 'gameover' ? (
        <Pressable
          onPress={start}
          style={{
            paddingHorizontal: theme.spacing['2xl'],
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.primary,
          }}>
          <Text style={{ color: '#fff', fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            {phase === 'gameover' ? 'Try again' : 'Start'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
