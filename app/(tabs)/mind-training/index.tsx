import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components';
import { MIND_EXERCISES, useBestScores } from '@/modules/mind-training';
import { useAppTheme } from '@/theme';

export default function MindTrainingScreen() {
  const theme = useAppTheme();
  const { best, loading } = useBestScores(MIND_EXERCISES);

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.md }}>
        {MIND_EXERCISES.map((exercise) => (
          <Link key={exercise.key} href={{ pathname: '/mind-training/[exerciseKey]', params: { exerciseKey: exercise.key } }} asChild>
            <Pressable>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="bulb" size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                    {exercise.title}
                  </Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{exercise.description}</Text>
                </View>
                {!loading && best[exercise.key] != null ? (
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    Best: {best[exercise.key]}
                    {exercise.scoreLabel === '% accuracy' ? '%' : ` ${exercise.scoreLabel}`}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScreenContainer>
  );
}
