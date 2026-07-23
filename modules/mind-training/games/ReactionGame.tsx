import { useEffect, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useAppTheme } from '@/theme';

type Phase = 'idle' | 'waiting' | 'go' | 'tooSoon' | 'result';

export function ReactionGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [phase, setPhase] = useState<Phase>('idle');
  const [resultMs, setResultMs] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef(0);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const start = () => {
    setPhase('waiting');
    setResultMs(null);
    const delay = 1000 + Math.random() * 3000;
    timeoutRef.current = setTimeout(() => {
      startRef.current = Date.now();
      setPhase('go');
    }, delay);
  };

  const onPress = () => {
    if (phase === 'idle' || phase === 'tooSoon' || phase === 'result') {
      start();
      return;
    }
    if (phase === 'waiting') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPhase('tooSoon');
      return;
    }
    if (phase === 'go') {
      const reaction = Date.now() - startRef.current;
      setResultMs(reaction);
      setPhase('result');
      onScore(reaction);
    }
  };

  const backgroundColor: Record<Phase, string> = {
    idle: theme.colors.surface,
    waiting: theme.colors.dangerMuted,
    go: theme.colors.success,
    tooSoon: theme.colors.warningMuted,
    result: theme.colors.primaryMuted,
  };

  const label: Record<Phase, string> = {
    idle: 'Tap to start',
    waiting: 'Wait for green…',
    go: 'Tap now!',
    tooSoon: 'Too soon — tap to retry',
    result: `${resultMs} ms — tap to retry`,
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: theme.radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: backgroundColor[phase],
      }}>
      <Text
        style={{
          fontSize: theme.typography.size.xl,
          fontWeight: theme.typography.weight.bold,
          color: phase === 'go' ? '#fff' : theme.colors.textPrimary,
        }}>
        {label[phase]}
      </Text>
    </Pressable>
  );
}
