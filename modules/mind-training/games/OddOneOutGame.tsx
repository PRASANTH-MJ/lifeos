import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const TOTAL_ROUNDS = 8;
const GRID_SIZE = 9;
const ROUND_TIMEOUT_MS = 4000;
const ICON_PAIRS: [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap][] = [
  ['heart', 'heart-outline'],
  ['star', 'star-outline'],
  ['square', 'square-outline'],
  ['triangle', 'triangle-outline'],
  ['ellipse', 'ellipse-outline'],
  ['bookmark', 'bookmark-outline'],
];

function makeRound() {
  const [common, odd] = ICON_PAIRS[Math.floor(Math.random() * ICON_PAIRS.length)];
  const oddIndex = Math.floor(Math.random() * GRID_SIZE);
  return { common, odd, oddIndex };
}

export function OddOneOutGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [phase, setPhase] = useState<'idle' | 'running' | 'result'>('idle');
  const [round, setRound] = useState(makeRound());
  const [roundsDone, setRoundsDone] = useState(0);
  const [correct, setCorrect] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answeredRef = useRef(false);
  // Authoritative counters — a plain closure would go stale across the self-rescheduling
  // setTimeout chain below, since each render captures its own `advance` function.
  const doneRef = useRef(0);
  const correctRef = useRef(0);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const advance = (wasCorrect: boolean) => {
    if (wasCorrect) correctRef.current += 1;
    doneRef.current += 1;
    setCorrect(correctRef.current);
    setRoundsDone(doneRef.current);

    if (doneRef.current >= TOTAL_ROUNDS) {
      setPhase('result');
      onScore(Math.round((correctRef.current / TOTAL_ROUNDS) * 100));
      return;
    }
    answeredRef.current = false;
    setRound(makeRound());
    timeoutRef.current = setTimeout(() => advance(false), ROUND_TIMEOUT_MS);
  };

  const start = () => {
    doneRef.current = 0;
    correctRef.current = 0;
    setRoundsDone(0);
    setCorrect(0);
    answeredRef.current = false;
    setRound(makeRound());
    setPhase('running');
    timeoutRef.current = setTimeout(() => advance(false), ROUND_TIMEOUT_MS);
  };

  const onCellPress = (index: number) => {
    if (phase !== 'running' || answeredRef.current) return;
    answeredRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    advance(index === round.oddIndex);
  };

  return (
    <View style={{ flex: 1, gap: theme.spacing.lg, alignItems: 'center', justifyContent: 'center' }}>
      {phase === 'running' ? (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          Find the odd one — round {roundsDone + 1}/{TOTAL_ROUNDS}
        </Text>
      ) : phase === 'result' ? (
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
          {correct}/{TOTAL_ROUNDS} correct
        </Text>
      ) : (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
          Tap the icon that's different from the rest, before time runs out.
        </Text>
      )}

      {phase === 'running' ? (
        <View style={{ width: 240, flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {Array.from({ length: GRID_SIZE }, (_, index) => (
            <Pressable
              key={index}
              onPress={() => onCellPress(index)}
              style={{
                width: 74,
                height: 74,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={index === round.oddIndex ? round.odd : round.common} size={28} color={theme.colors.textPrimary} />
            </Pressable>
          ))}
        </View>
      ) : null}

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
