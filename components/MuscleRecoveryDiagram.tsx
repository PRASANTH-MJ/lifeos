import Body, { type Slug } from 'react-native-body-highlighter';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/theme';
import { MUSCLE_TO_SLUG } from './ExerciseMuscleDiagram';

/** Highlights only muscles still recovering (<80%) — a fully-recovered muscle has nothing to draw
 * attention to, so it's left in the neutral default color rather than crowding the diagram with
 * a third "all good" highlight. Red = still fatigued, amber = getting there. */
export function MuscleRecoveryDiagram({ recoveryByMuscle }: { recoveryByMuscle: Record<string, number> }) {
  const theme = useAppTheme();

  const data = useMemo(() => {
    const bySlug = new Map<Slug, number>();
    for (const [muscle, recovery] of Object.entries(recoveryByMuscle)) {
      const slug = MUSCLE_TO_SLUG[muscle];
      if (!slug || recovery >= 80) continue;
      const existing = bySlug.get(slug);
      if (existing === undefined || recovery < existing) bySlug.set(slug, recovery);
    }
    return Array.from(bySlug.entries()).map(([slug, recovery]) => ({
      slug,
      intensity: recovery < 50 ? 2 : 1,
    }));
  }, [recoveryByMuscle]);

  const colors = [theme.colors.warning, theme.colors.danger];

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl }}>
      <Body data={data} side="front" colors={colors} scale={1.1} defaultFill={theme.colors.border} defaultStroke={theme.colors.textTertiary} />
      <Body data={data} side="back" colors={colors} scale={1.1} defaultFill={theme.colors.border} defaultStroke={theme.colors.textTertiary} />
    </View>
  );
}
