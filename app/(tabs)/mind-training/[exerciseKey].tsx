import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { EmptyState, ScreenContainer } from '@/components';
import { GoNoGoGame, ReactionGame, SequenceGame, findExercise, useMindTrainingLogs } from '@/modules/mind-training';
import { useAppTheme } from '@/theme';

export default function MindExerciseScreen() {
  const theme = useAppTheme();
  const { exerciseKey } = useLocalSearchParams<{ exerciseKey: string }>();
  const exercise = findExercise(exerciseKey);
  const { logScore } = useMindTrainingLogs();

  if (!exercise) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Exercise not found" />
      </ScreenContainer>
    );
  }

  const onScore = (score: number) => {
    logScore(exercise.key, score);
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, gap: theme.spacing.lg }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            {exercise.title}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{exercise.description}</Text>
        </View>
        {exercise.key === 'reaction' ? <ReactionGame onScore={onScore} /> : null}
        {exercise.key === 'sequence' ? <SequenceGame onScore={onScore} /> : null}
        {exercise.key === 'go-no-go' ? <GoNoGoGame onScore={onScore} /> : null}
      </View>
    </ScreenContainer>
  );
}
