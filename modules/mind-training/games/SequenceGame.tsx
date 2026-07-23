import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const STEP_MS = 700;
const TILE_ON_MS = 400;
const PAUSE_BEFORE_NEXT_ROUND_MS = 600;

export function SequenceGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const tileColors = [theme.colors.danger, theme.colors.success, theme.colors.primary, theme.colors.warning];

  const [sequence, setSequence] = useState<number[]>([]);
  const [userStep, setUserStep] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'gameover'>('idle');
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => clearTimeouts, []);

  const playback = (seq: number[]) => {
    setPhase('showing');
    setActiveTile(null);
    seq.forEach((tile, i) => {
      timeoutsRef.current.push(setTimeout(() => setActiveTile(tile), i * STEP_MS));
      timeoutsRef.current.push(setTimeout(() => setActiveTile(null), i * STEP_MS + TILE_ON_MS));
    });
    timeoutsRef.current.push(
      setTimeout(() => {
        setPhase('input');
        setUserStep(0);
      }, seq.length * STEP_MS)
    );
  };

  const start = () => {
    clearTimeouts();
    const first = [Math.floor(Math.random() * 4)];
    setSequence(first);
    playback(first);
  };

  const onTilePress = (tile: number) => {
    if (phase !== 'input') return;

    if (sequence[userStep] === tile) {
      const nextStep = userStep + 1;
      if (nextStep === sequence.length) {
        const grown = [...sequence, Math.floor(Math.random() * 4)];
        setSequence(grown);
        setPhase('showing');
        timeoutsRef.current.push(setTimeout(() => playback(grown), PAUSE_BEFORE_NEXT_ROUND_MS));
      } else {
        setUserStep(nextStep);
      }
    } else {
      clearTimeouts();
      onScore(Math.max(sequence.length - 1, 0));
      setPhase('gameover');
    }
  };

  const statusLabel = {
    idle: 'Tap Start to begin',
    showing: 'Watch the pattern…',
    input: `Level ${sequence.length} — your turn (${userStep}/${sequence.length})`,
    gameover: `Game over — reached level ${Math.max(sequence.length - 1, 0)}`,
  }[phase];

  return (
    <View style={{ flex: 1, gap: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
        {statusLabel}
      </Text>

      <View style={{ width: 220, height: 220, flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {[0, 1, 2, 3].map((tile) => (
          <Pressable
            key={tile}
            onPress={() => onTilePress(tile)}
            style={{
              width: 104,
              height: 104,
              borderRadius: theme.radius.md,
              backgroundColor: tileColors[tile],
              opacity: activeTile === tile ? 1 : 0.35,
            }}
          />
        ))}
      </View>

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
