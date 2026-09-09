import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const ICONS: (keyof typeof Ionicons.glyphMap)[] = ['star', 'heart', 'moon', 'sunny', 'leaf', 'flash', 'water', 'flame'];
const FLIP_BACK_MS = 700;

type Card = { icon: keyof typeof Ionicons.glyphMap; matched: boolean };

function shuffledDeck(): Card[] {
  const deck = [...ICONS, ...ICONS].map((icon) => ({ icon, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryMatchGame({ onScore }: { onScore: (score: number) => void }) {
  const theme = useAppTheme();
  const [phase, setPhase] = useState<'idle' | 'running' | 'result'>('idle');
  const [deck, setDeck] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const busyRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const start = () => {
    setDeck(shuffledDeck());
    setFlipped([]);
    setMoves(0);
    busyRef.current = false;
    setPhase('running');
  };

  const onCardPress = (index: number) => {
    if (phase !== 'running' || busyRef.current || flipped.includes(index) || deck[index].matched) return;
    const nextFlipped = [...flipped, index];
    setFlipped(nextFlipped);
    if (nextFlipped.length < 2) return;

    busyRef.current = true;
    const [a, b] = nextFlipped;
    const isMatch = deck[a].icon === deck[b].icon;
    setMoves((m) => m + 1);

    timeoutRef.current = setTimeout(
      () => {
        setDeck((current) => {
          const next = current.map((card, i) => (isMatch && (i === a || i === b) ? { ...card, matched: true } : card));
          if (next.every((card) => card.matched)) {
            setPhase('result');
            onScore(moves + 1);
          }
          return next;
        });
        setFlipped([]);
        busyRef.current = false;
      },
      isMatch ? 200 : FLIP_BACK_MS
    );
  };

  return (
    <View style={{ flex: 1, gap: theme.spacing.lg, alignItems: 'center', justifyContent: 'center' }}>
      {phase === 'running' ? (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Moves: {moves}</Text>
      ) : phase === 'result' ? (
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
          Solved in {moves} moves!
        </Text>
      ) : (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
          Find all 8 matching pairs in as few moves as possible.
        </Text>
      )}

      {phase !== 'idle' ? (
        <View style={{ width: 264, flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {deck.map((card, index) => {
            const revealed = card.matched || flipped.includes(index);
            return (
              <Pressable
                key={index}
                onPress={() => onCardPress(index)}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: theme.radius.md,
                  backgroundColor: revealed ? theme.colors.primaryMuted : theme.colors.surface,
                  borderWidth: 1,
                  borderColor: card.matched ? theme.colors.success : theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {revealed ? <Ionicons name={card.icon} size={26} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        onPress={start}
        style={{ paddingHorizontal: theme.spacing['2xl'], paddingVertical: theme.spacing.md, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary }}>
        <Text style={{ color: '#fff', fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          {phase === 'idle' ? 'Start' : 'Restart'}
        </Text>
      </Pressable>
    </View>
  );
}
