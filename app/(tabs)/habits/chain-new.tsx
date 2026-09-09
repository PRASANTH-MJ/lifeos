import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, IconBadge, ScreenContainer, TextField } from '@/components';
import { useHabitChains, useHabits } from '@/modules/habits';
import { useAppTheme } from '@/theme';

/** "Create chain" flow — pick from the user's existing habits, then order them with up/down
 * arrows (this app has no drag-reorder pattern elsewhere — see moveHabit/moveRecurringTask, both
 * button-based — so this stays consistent with that rather than introducing drag-and-drop). */
export default function CreateChainScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { habits } = useHabits();
  const { createChain } = useHabitChains();

  const [name, setName] = useState('');
  const [orderedSyncIds, setOrderedSyncIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleHabit = (syncId: string | null) => {
    if (!syncId) return;
    setOrderedSyncIds((ids) => (ids.includes(syncId) ? ids.filter((id) => id !== syncId) : [...ids, syncId]));
  };

  const move = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    setOrderedSyncIds((ids) => {
      if (swapIndex < 0 || swapIndex >= ids.length) return ids;
      const next = [...ids];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const habitBySyncId = new Map(habits.map(({ habit }) => [habit.sync_id, habit]));
  const canSave = name.trim().length > 0 && orderedSyncIds.length >= 2;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createChain(name.trim(), orderedSyncIds);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (habits.length === 0) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'New Chain' }} />
        <EmptyState
          icon="link-outline"
          title="No habits yet"
          subtitle="Add a couple of habits first, then come back to chain them together."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'New Chain' }} />
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="Chain name" placeholder="e.g. Morning routine" value={name} onChangeText={setName} autoFocus />

        {orderedSyncIds.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Order
            </Text>
            {orderedSyncIds.map((syncId, index) => {
              const habit = habitBySyncId.get(syncId);
              if (!habit) return null;
              return (
                <Card key={syncId} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Text style={{ width: 18, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {index + 1}
                  </Text>
                  <IconBadge name={habit.icon as never} color={theme.colors.moduleHabits} size="sm" />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }} numberOfLines={1}>
                    {habit.name}
                  </Text>
                  <View style={{ alignItems: 'center' }}>
                    <Pressable accessibilityLabel={`Move ${habit.name} up`} onPress={() => move(index, 'up')} disabled={index === 0} hitSlop={6}>
                      <Ionicons name="chevron-up" size={16} color={index === 0 ? theme.colors.border : theme.colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Move ${habit.name} down`}
                      onPress={() => move(index, 'down')}
                      disabled={index === orderedSyncIds.length - 1}
                      hitSlop={6}>
                      <Ionicons name="chevron-down" size={16} color={index === orderedSyncIds.length - 1 ? theme.colors.border : theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                  <Pressable accessibilityLabel={`Remove ${habit.name} from chain`} onPress={() => toggleHabit(syncId)} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={20} color={theme.colors.textTertiary} />
                  </Pressable>
                </Card>
              );
            })}
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Add habits to the chain
          </Text>
          {habits
            .filter(({ habit }) => !orderedSyncIds.includes(habit.sync_id ?? ''))
            .map(({ habit }) => (
              <Pressable key={habit.id} onPress={() => toggleHabit(habit.sync_id)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <IconBadge name={habit.icon as never} color={theme.colors.moduleHabits} size="sm" />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }} numberOfLines={1}>
                    {habit.name}
                  </Text>
                  <Ionicons name="add-circle-outline" size={20} color={theme.colors.moduleHabits} />
                </Card>
              </Pressable>
            ))}
        </View>

        <Button label="Create chain" onPress={onSave} disabled={!canSave} loading={saving} />
        {!canSave ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
            {!name.trim() ? 'Name the chain to continue' : 'Pick at least 2 habits to chain together'}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
