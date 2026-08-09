import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const GRID_SIZE = 9;
const TOTAL_MOLES = 20;
const MOLE_UP_MS = 800;
const GAP_MS = 300;

export function WhackAMoleGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [phase, setPhase] = useState<'idle' | 'running' | 'result'>('idle');
  const [activeHole, setActiveHole] = useState<number | null>(null);
  const [molesShown, setMolesShown] = useState(0);
  const [hits, setHits] = useState(0);
  const hitRef = useRef(false);
  const hitsRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const nextMole = (shown: number) => {
    if (shown >= TOTAL_MOLES) {
      setActiveHole(null);
      setPhase('result');
      onScore(Math.round((hitsRef.current / TOTAL_MOLES) * 100));
      return;
    }
    const hole = Math.floor(Math.random() * GRID_SIZE);
    hitRef.current = false;
    setActiveHole(hole);
    timeoutRef.current = setTimeout(() => {
      setActiveHole(null);
      const nextShown = shown + 1;
      setMolesShown(nextShown);
      timeoutRef.current = setTimeout(() => nextMole(nextShown), GAP_MS);
    }, MOLE_UP_MS);
  };

  const start = () => {
    hitsRef.current = 0;
    setHits(0);
    setMolesShown(0);
    setPhase('running');
    nextMole(0);
  };

  const onHolePress = (hole: number) => {
    if (phase !== 'running' || hole !== activeHole || hitRef.current) return;
    hitRef.current = true;
    hitsRef.current += 1;
    setHits(hitsRef.current);
    setActiveHole(null);
  };

  return (
    <View style={{ flex: 1, gap: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
      {phase === 'running' ? (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          Mole {Math.min(molesShown + 1, TOTAL_MOLES)}/{TOTAL_MOLES} — {hits} hits
        </Text>
      ) : phase === 'result' ? (
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
          {hits}/{TOTAL_MOLES} hits
        </Text>
      ) : (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
          Tap the hole the moment it lights up.
        </Text>
      )}

      <View style={{ width: 240, height: 240, flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {Array.from({ length: GRID_SIZE }, (_, hole) => (
          <Pressable
            key={hole}
            onPress={() => onHolePress(hole)}
            style={{
              width: 74,
              height: 74,
              borderRadius: theme.radius.md,
              backgroundColor: activeHole === hole ? theme.colors.success : theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          />
        ))}
      </View>

      {phase === 'idle' || phase === 'result' ? (
        <Pressable
          onPress={start}
          style={{ paddingHorizontal: theme.spacing['2xl'], paddingVertical: theme.spacing.md, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary }}>
          <Text style={{ color: '#fff', fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            {phase === 'result' ? 'Try again' : 'Start'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
