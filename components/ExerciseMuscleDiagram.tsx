import Body, { type Slug } from 'react-native-body-highlighter';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/theme';

// wger's muscle names → this library's fixed slug set. A few are nearest-visual-region
// approximations, not anatomically exact — Brachialis/Soleus have no dedicated slug (mapped to
// the adjacent Biceps/Calves region), and Lats/Serratus anterior similarly fall back to the
// closest available back/side region (upper-back, obliques). Good enough for "roughly where this
// hits," not a medical diagram.
export const MUSCLE_TO_SLUG: Record<string, Slug> = {
  Abs: 'abs',
  Biceps: 'biceps',
  Brachialis: 'biceps',
  Calves: 'calves',
  Chest: 'chest',
  Glutes: 'gluteal',
  Hamstrings: 'hamstring',
  Lats: 'upper-back',
  'Obliquus externus abdominis': 'obliques',
  Quads: 'quadriceps',
  'Serratus anterior': 'obliques',
  Shoulders: 'deltoids',
  Soleus: 'calves',
  Trapezius: 'trapezius',
  Triceps: 'triceps',
};

export function ExerciseMuscleDiagram({ muscles, musclesSecondary }: { muscles: string[]; musclesSecondary: string[] }) {
  const theme = useAppTheme();

  const data = useMemo(() => {
    const primary = new Set(muscles.map((m) => MUSCLE_TO_SLUG[m]).filter((s): s is Slug => !!s));
    const secondary = new Set(
      musclesSecondary.map((m) => MUSCLE_TO_SLUG[m]).filter((s): s is Slug => !!s && !primary.has(s))
    );
    return [
      ...Array.from(primary).map((slug) => ({ slug, intensity: 2 })),
      ...Array.from(secondary).map((slug) => ({ slug, intensity: 1 })),
    ];
  }, [muscles, musclesSecondary]);

  if (data.length === 0) return null;

  const colors = [theme.colors.moduleTasksMuted, theme.colors.moduleTasks];

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl }}>
      <Body data={data} side="front" colors={colors} scale={1.1} defaultFill={theme.colors.border} defaultStroke={theme.colors.textTertiary} />
      <Body data={data} side="back" colors={colors} scale={1.1} defaultFill={theme.colors.border} defaultStroke={theme.colors.textTertiary} />
    </View>
  );
}
