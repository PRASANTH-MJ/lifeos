import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button, TextField } from '@/components';
import { useAppTheme } from '@/theme';
import type { TaskLabel } from './types';

const LABEL_COLOR_OPTIONS = ['#8E8E93', '#3D8BFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'];

type Props = {
  labels: TaskLabel[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreate: (name: string, color: string) => Promise<string>;
};

/** Multi-select chip picker with an inline "create new" modal — mirrors CategoryPicker's
 * create-flow, but selection is a toggleable set instead of one exclusive pick (a task can carry
 * several labels at once, the same way a transaction can in Finance's labels chips). */
export function TaskLabelPicker({ labels, selectedIds, onToggle, onCreate }: Props) {
  const theme = useAppTheme();
  const [creating, setCreating] = useState(false);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {labels.map((label) => {
          const selected = selectedIds.includes(label.id);
          return (
            <Pressable
              key={label.id}
              onPress={() => onToggle(label.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: selected ? label.color : theme.colors.border,
                backgroundColor: selected ? `${label.color}22` : theme.colors.surface,
              }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: label.color }} />
              <Text style={{ color: selected ? label.color : theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{label.name}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setCreating(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderStyle: 'dashed',
          }}>
          <Ionicons name="add" size={14} color={theme.colors.textSecondary} />
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Create label</Text>
        </Pressable>
      </View>

      <Modal visible={creating} animationType="slide" transparent onRequestClose={() => setCreating(false)}>
        <NewLabelForm
          onCancel={() => setCreating(false)}
          onSave={async (name, color) => {
            const id = await onCreate(name, color);
            onToggle(id);
            setCreating(false);
          }}
        />
      </Modal>
    </View>
  );
}

function NewLabelForm({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string, color: string) => Promise<void> }) {
  const theme = useAppTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(LABEL_COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  return (
    <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onCancel} />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          padding: theme.spacing.xl,
          gap: theme.spacing.lg,
        }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
          New label
        </Text>
        <TextField label="Name" placeholder="e.g. Waiting on someone" value={name} onChangeText={setName} autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {LABEL_COLOR_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setColor(option)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: option,
                  borderWidth: color === option ? 3 : 0,
                  borderColor: theme.colors.textPrimary,
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button label="Cancel" variant="ghost" onPress={onCancel} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Save"
              onPress={async () => {
                setSaving(true);
                await onSave(name.trim(), color);
                setSaving(false);
              }}
              disabled={name.trim().length === 0}
              loading={saving}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
