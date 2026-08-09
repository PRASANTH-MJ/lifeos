import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingState, ReminderCard, ScreenContainer, TextField } from '@/components';
import { formatDisplayDateTime, todayKey } from '@/lib/date';
import { useUserDetails } from '@/modules/onboarding';
import { useModuleReminders } from '@/modules/reminders';
import { suggestedWaterGoalMl, useWaterDay } from '@/modules/water';
import { useAppTheme } from '@/theme';

const QUICK_AMOUNTS = [150, 250, 500];

export default function WaterScreen() {
  const theme = useAppTheme();
  const { logs, totalMl, goalMl, loading, addLog, removeLog, setGoal, refresh } = useWaterDay(todayKey());
  const { details } = useUserDetails();
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders('water', 'Time to hydrate', "Don't forget to drink some water.");
  const [customAmount, setCustomAmount] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalMl));

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
    await addLog(amount);
    setCustomAmount('');
  };

  const onDelete = (id: number) => {
    Alert.alert('Remove this entry?', undefined, [
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
            <Ionicons name="water" size={28} color={theme.colors.moduleTasks} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {totalMl} ml
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>of {goalMl} ml</Text>
          </View>
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
            <Pressable
              key={amount}
              onPress={() => addLog(amount)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.moduleTasksMuted,
              }}>
              <Text style={{ color: theme.colors.moduleTasks, fontWeight: theme.typography.weight.semibold }}>+{amount} ml</Text>
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

        <View style={{ gap: theme.spacing.sm }}>
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
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <Ionicons name="water" size={18} color={theme.colors.moduleTasks} />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{log.amount_ml} ml</Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDateTime(log.created_at)}</Text>
                  </Card>
                </Pressable>
              ))
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
