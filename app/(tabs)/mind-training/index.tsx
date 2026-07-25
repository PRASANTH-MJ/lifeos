import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, LogPastEntryModal, ScreenContainer, TextField } from '@/components';
import { todayKey } from '@/lib/date';
import { MIND_EXERCISES, useBestScores, useMindTrainingLogs } from '@/modules/mind-training';
import { useAppTheme } from '@/theme';

export default function MindTrainingScreen() {
  const theme = useAppTheme();
  const { best, loading, refresh } = useBestScores(MIND_EXERCISES);
  const { logScore } = useMindTrainingLogs();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logExerciseKey, setLogExerciseKey] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(todayKey());
  const [logScoreText, setLogScoreText] = useState('');

  const selectedExercise = MIND_EXERCISES.find((exercise) => exercise.key === logExerciseKey);

  const onSaveLog = async () => {
    if (!logExerciseKey || !logScoreText.trim()) return;
    await logScore(logExerciseKey, Number(logScoreText), logDate);
    setLogScoreText('');
    setLogModalVisible(false);
  };

  return (
    <ScreenContainer onRefresh={refresh}>
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

        <Pressable
          onPress={() => {
            setLogExerciseKey(MIND_EXERCISES[0].key);
            setLogDate(todayKey());
            setLogScoreText('');
            setLogModalVisible(true);
          }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Log a past result
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Card>
        </Pressable>
      </View>

      <LogPastEntryModal
        visible={logModalVisible}
        title="Log a past result"
        items={MIND_EXERCISES.map((e) => ({ key: e.key, label: e.title }))}
        selectedItemKey={logExerciseKey}
        onSelectItem={setLogExerciseKey}
        date={logDate}
        onSelectDate={setLogDate}
        onClose={() => setLogModalVisible(false)}
        onSave={onSaveLog}
        saveDisabled={!logScoreText.trim()}
        moduleColor={theme.colors.primary}
        moduleMutedColor={theme.colors.primaryMuted}
        extra={
          <TextField
            label={`Score${selectedExercise ? ` (${selectedExercise.scoreLabel})` : ''}`}
            placeholder="e.g. 320"
            value={logScoreText}
            onChangeText={setLogScoreText}
            keyboardType="decimal-pad"
          />
        }
      />
    </ScreenContainer>
  );
}
