import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button, TextField } from '@/components';
import type { Task } from '@/modules/tasks';
import { useAppTheme } from '@/theme';

type Props = {
  visible: boolean;
  tasks: Task[];
  initialTaskId?: number | null;
  onSkip: () => void;
  onSave: (details: { taskId: number | null; note: string | null }) => Promise<void>;
};

/**
 * Shown right after a stopwatch/countdown/Pomodoro session is saved (see app/(tabs)/timer/
 * index.tsx) — lets the user attach the just-logged session to a task (or a checklist item, which
 * in this app is just a task with a parent_task_id, so the flat task list already covers both) and
 * jot a note about what was actually worked on. Purely optional: "Skip" leaves the session exactly
 * as logSession already saved it (see useTimerLogs' task_id param for the "Focus on this" case,
 * where this modal still offers a chance to add a note on top).
 */
export function TimerSessionDetailsModal({ visible, tasks, onSkip, onSave }: Props) {
  const theme = useAppTheme();
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => task.title.toLowerCase().includes(query));
  }, [tasks, search]);

  const reset = () => {
    setSearch('');
    setSelectedTaskId(null);
    setNote('');
  };

  const handleSkip = () => {
    reset();
    onSkip();
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ taskId: selectedTaskId, note: note.trim() ? note.trim() : null });
    setSaving(false);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleSkip}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={handleSkip} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
            maxHeight: '80%',
          }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            Add details
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
            Attach this session to a task or checklist item, and jot down what you worked on.
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Task
            </Text>
            <TextField placeholder="Search tasks" value={search} onChangeText={setSearch} />
            <View style={{ maxHeight: 180, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border }}>
              <FlatList
                data={filteredTasks}
                keyExtractor={(task) => String(task.id)}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, padding: theme.spacing.md }}>
                    No matching tasks
                  </Text>
                }
                renderItem={({ item }) => {
                  const selected = selectedTaskId === item.id;
                  return (
                    <Pressable
                      onPress={() => setSelectedTaskId(selected ? null : item.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        backgroundColor: selected ? `${theme.colors.moduleTasks}22` : 'transparent',
                      }}>
                      <Ionicons
                        name={item.parent_task_id ? 'checkbox-outline' : 'ellipse-outline'}
                        size={16}
                        color={selected ? theme.colors.moduleTasks : theme.colors.textTertiary}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          color: selected ? theme.colors.moduleTasks : theme.colors.textPrimary,
                          fontSize: theme.typography.size.sm,
                          fontWeight: selected ? theme.typography.weight.semibold : theme.typography.weight.regular,
                        }}>
                        {item.title}
                      </Text>
                      {selected ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.moduleTasks} /> : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>

          <TextField
            label="Note"
            placeholder="What did you work on?"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button label="Skip" variant="ghost" onPress={handleSkip} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Save" onPress={handleSave} loading={saving} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
