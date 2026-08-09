import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const ROUND_SECONDS = 30;

type Problem = { text: string; answer: number; choices: number[] };

function makeProblem(): Problem {
  const ops = ['+', '-', '×'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a = Math.floor(Math.random() * 12) + 1;
  let b = Math.floor(Math.random() * 12) + 1;
  if (op === '-' && b > a) [a, b] = [b, a];
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const choices = new Set<number>([answer]);
  while (choices.size < 4) {
    const delta = Math.floor(Math.random() * 9) - 4;
    const candidate = answer + delta;
    if (candidate !== answer) choices.add(candidate);
  }
  return { text: `${a} ${op} ${b}`, answer, choices: Array.from(choices).sort(() => Math.random() - 0.5) };
}

export function MathSprintGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [phase, setPhase] = useState<'idle' | 'running' | 'result'>('idle');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const correctRef = useRef(0);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    []
  );

  const start = () => {
    correctRef.current = 0;
    setCorrectCount(0);
    setSecondsLeft(ROUND_SECONDS);
    setProblem(makeProblem());
    setPhase('running');
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPhase('result');
        onScore(correctRef.current);
        return 0;
      });
    }, 1000);
  };

  const onChoice = (value: number) => {
    if (phase !== 'running' || !problem) return;
    if (value === problem.answer) {
      correctRef.current += 1;
      setCorrectCount(correctRef.current);
    }
    setProblem(makeProblem());
  };

  return (
    <View style={{ flex: 1, gap: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
      {phase === 'running' ? (
        <>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
            {secondsLeft}s left · {correctCount} correct
          </Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: 44, fontWeight: theme.typography.weight.bold }}>{problem?.text}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center', width: 260 }}>
            {problem?.choices.map((choice) => (
              <Pressable
                key={choice}
                onPress={() => onChoice(choice)}
                style={{
                  width: 116,
                  paddingVertical: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center',
                }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.semibold }}>
                  {choice}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          {phase === 'result' ? (
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {correctCount} correct in {ROUND_SECONDS}s
            </Text>
          ) : (
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
              Answer as many as you can in {ROUND_SECONDS} seconds.
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
