import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  IconBadge,
  LoadingState,
  PostToFeedPrompt,
  ProgressBar,
  ReminderCard,
  ScreenContainer,
  ShareCardModal,
  StreakBadge,
  TextField,
  type ShareCardData,
  showAlert,
} from '@/components';
import { formatDisplayDateTime, todayKey } from '@/lib/date';
import { useUserDetails } from '@/modules/onboarding';
import { useModuleReminders } from '@/modules/reminders';
import { suggestedWaterGoalMl, useWaterDay, useWaterStreak } from '@/modules/water';
import { useAppTheme } from '@/theme';

const QUICK_AMOUNTS = [150, 250, 500];

export default function WaterScreen() {
  const theme = useAppTheme();
  const { logs, totalMl, goalMl, loading, addLog, removeLog, setGoal, refresh } = useWaterDay(todayKey());
  const streak = useWaterStreak();
  const { details } = useUserDetails();
  const [shareCard, setShareCard] = useState<ShareCardData | null>(null);
  const onShareStreak = () => {
    setShareCard({
      eyebrow: 'Hydration streak',
      value: String(streak),
      valueLabel: `day streak${streak === 1 ? '' : 's'}`,
      detail: 'Staying hydrated on Flowsy',
      icon: 'water',
      accentColor: theme.colors.moduleTasks,
    });
  };
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders('water', 'Time to hydrate', "Don't forget to drink some water.");
  const [customAmount, setCustomAmount] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalMl));
  // Shows once, right when a log pushes the day's total from below goal to at/above it — not on
  // every glass logged, which would be spammy given water is logged many times a day.
  const [goalReachedPromptVisible, setGoalReachedPromptVisible] = useState(false);

  const onAddWater = async (amount: number) => {
    const wasBelowGoal = totalMl < goalMl;
    await addLog(amount);
    if (wasBelowGoal && totalMl + amount >= goalMl) setGoalReachedPromptVisible(true);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const progress = Math.min(totalMl / goalMl, 1);
  const remaining = Math.max(goalMl - totalMl, 0);
  const suggestedGoal = details?.weightKg ? suggestedWaterGoalMl(details.weightKg) : null;

  const onAddCustom = async () => {
    const amount = Math.round(Number(customAmount));
    if (!(amount > 0)) return;
    await onAddWater(amount);
    setCustomAmount('');
  };

  const onDelete = (id: number) => {
    showAlert('Remove this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeLog(id) },
    ]);
  };

  const onSaveGoal = async () => {
    const value = Math.round(Number(goalInput));
    if (value > 0) await setGoal(value);
    setEditingGoal(false);
  };

  return (
    <ScreenContainer onRefresh={refresh}>
      <View style={{ gap: theme.spacing.xl }}>
        <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              borderWidth: 10,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <View
              style={{
                position: 'absolute',
                width: 140,
                height: 140,
                borderRadius: 70,
                borderWidth: 10,
                borderColor: theme.colors.moduleTasks,
                opacity: progress,
              }}
            />
            <IconBadge name="water" color={theme.colors.moduleTasks} size="lg" />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {totalMl} ml
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>of {goalMl} ml</Text>
          </View>
          <View style={{ width: '100%' }}>
            <ProgressBar progress={progress} color={theme.colors.moduleTasks} height={4} />
          </View>
          <StreakBadge streak={streak} onPress={onShareStreak} />
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
            {remaining > 0 ? `${remaining} ml to go today` : "You've hit your goal today!"}
          </Text>

          {editingGoal ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end', width: '100%' }}>
              <View style={{ flex: 1 }}>
                <TextField label="Daily goal (ml)" value={goalInput} onChangeText={setGoalInput} keyboardType="number-pad" />
              </View>
              <Button label="Save" onPress={onSaveGoal} />
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
              <Pressable onPress={() => { setGoalInput(String(goalMl)); setEditingGoal(true); }}>
                <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  Change daily goal
                </Text>
              </Pressable>
              {suggestedGoal && suggestedGoal !== goalMl ? (
                <Pressable onPress={() => setGoal(suggestedGoal)}>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                    Suggested for your weight: {suggestedGoal} ml — tap to use
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </Card>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {QUICK_AMOUNTS.map((amount) => (
            <Pressable key={amount} onPress={() => onAddWater(amount)} style={{ flex: 1 }}>
              <Card tier="elevated" style={{ alignItems: 'center', gap: theme.spacing.xs }}>
                <IconBadge name="water" color={theme.colors.moduleTasks} size="sm" />
                <Text style={{ color: theme.colors.moduleTasks, fontWeight: theme.typography.weight.semibold }}>+{amount} ml</Text>
              </Card>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Custom amount (ml)" value={customAmount} onChangeText={setCustomAmount} keyboardType="number-pad" />
          </View>
          <Button label="Add" onPress={onAddCustom} disabled={!(Number(customAmount) > 0)} />
        </View>

        {reminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            state={reminder}
            onSave={(next) => saveReminder(reminder.id, next)}
            onRemove={reminders.length > 1 ? () => removeReminder(reminder.id) : undefined}
            color={theme.colors.moduleTasks}
          />
        ))}
        <Button label={reminders.length > 0 ? 'Add another reminder' : 'Add a reminder'} variant="secondary" onPress={addReminder} />

        <Card tier="panel" style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Today's log
          </Text>
          {logs.length === 0 ? (
            <EmptyState icon="water-outline" title="Nothing logged yet" subtitle="Tap an amount above to log your first glass." />
          ) : (
            logs
              .slice()
              .reverse()
              .map((log) => (
                <Pressable key={log.id} onLongPress={() => onDelete(log.id)}>
                  <Card tier="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name="water" color={theme.colors.moduleTasks} size="sm" />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{log.amount_ml} ml</Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDateTime(log.created_at)}</Text>
                  </Card>
                </Pressable>
              ))
          )}
        </Card>
      </View>
      <ShareCardModal visible={!!shareCard} onClose={() => setShareCard(null)} data={shareCard} />

      <Modal visible={goalReachedPromptVisible} animationType="slide" transparent onRequestClose={() => setGoalReachedPromptVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setGoalReachedPromptVisible(false)} />
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.md,
            }}>
            <Card tier="elevated" style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="water" color={theme.colors.moduleTasks} size="lg" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                Goal reached! 💧
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{goalMl} ml today</Text>
            </Card>
            <PostToFeedPrompt
              type="milestone"
              card={{
                eyebrow: 'Hydration goal',
                value: String(goalMl),
                valueLabel: 'ML TODAY',
                detail: `${streak} day streak${streak === 1 ? '' : 's'}`,
                icon: 'water',
                accentColor: theme.colors.moduleTasks,
              }}
              onDone={() => setGoalReachedPromptVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
