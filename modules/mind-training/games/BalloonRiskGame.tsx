import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const TOTAL_BALLOONS = 5;
const POINTS_PER_PUMP = 5;
const MIN_POP = 4;
const MAX_POP = 20;

function randomPopThreshold() {
  return MIN_POP + Math.floor(Math.random() * (MAX_POP - MIN_POP + 1));
}

export function BalloonRiskGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [phase, setPhase] = useState<'idle' | 'running' | 'popped' | 'result'>('idle');
  const [balloonIndex, setBalloonIndex] = useState(0);
  const [pumps, setPumps] = useState(0);
  const [popAt, setPopAt] = useState(randomPopThreshold());
  const [banked, setBanked] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const start = () => {
    setBalloonIndex(0);
    setPumps(0);
    setPopAt(randomPopThreshold());
    setBanked(0);
    setPhase('running');
  };

  const nextBalloon = (nextBanked: number) => {
    const nextIndex = balloonIndex + 1;
    if (nextIndex >= TOTAL_BALLOONS) {
      setBanked(nextBanked);
      setPhase('result');
      onScore(nextBanked);
      return;
    }
    setBalloonIndex(nextIndex);
    setPumps(0);
    setPopAt(randomPopThreshold());
    setBanked(nextBanked);
    setPhase('running');
  };

  const onPump = () => {
    if (phase !== 'running') return;
    const next = pumps + 1;
    if (next >= popAt) {
      setPhase('popped');
      timeoutRef.current = setTimeout(() => nextBalloon(banked), 900);
      return;
    }
    setPumps(next);
  };

  const onCashOut = () => {
    if (phase !== 'running') return;
    nextBalloon(banked + pumps * POINTS_PER_PUMP);
  };

  const balloonSize = 60 + pumps * 6;

  return (
    <View style={{ flex: 1, gap: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
      {phase !== 'idle' && phase !== 'result' ? (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          Balloon {balloonIndex + 1}/{TOTAL_BALLOONS} · Banked: {banked} pts
        </Text>
      ) : null}

      {phase === 'result' ? (
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
          Final score: {banked} pts
        </Text>
      ) : phase === 'idle' ? (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
          Pump each balloon for points — but cash out before it pops, or you lose that round.
        </Text>
      ) : (
        <>
          <View
            style={{
              width: balloonSize,
              height: balloonSize,
              borderRadius: balloonSize / 2,
              backgroundColor: phase === 'popped' ? theme.colors.danger : theme.colors.warning,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {phase === 'popped' ? <Ionicons name="close" size={28} color="#fff" /> : null}
          </View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            {phase === 'popped' ? 'Popped! Lost this round.' : `Potential: ${pumps * POINTS_PER_PUMP} pts`}
          </Text>
          {phase === 'running' ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Pressable
                onPress={onPump}
                style={{ paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.full, backgroundColor: theme.colors.warning }}>
                <Text style={{ color: '#fff', fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>Pump</Text>
              </Pressable>
              <Pressable
                onPress={onCashOut}
                style={{ paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.full, backgroundColor: theme.colors.success }}>
                <Text style={{ color: '#fff', fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>Cash Out</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}

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
