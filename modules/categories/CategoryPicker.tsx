import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button, TextField } from '@/components';
import { useAppTheme } from '@/theme';
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS, type Category, type CategoryAppliesTo } from './types';

type Props = {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onCreate: (values: { name: string; icon: string; color: string; appliesTo: CategoryAppliesTo }) => Promise<number>;
  appliesTo: 'habit' | 'task';
};

export function CategoryPicker({ categories, selectedId, onSelect, onCreate, appliesTo }: Props) {
  const theme = useAppTheme();
  const [creating, setCreating] = useState(false);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {categories.map((category) => {
          const selected = selectedId === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => onSelect(selected ? null : category.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: selected ? category.color : theme.colors.border,
                backgroundColor: selected ? `${category.color}22` : theme.colors.surface,
              }}>
              <Ionicons name={category.icon as never} size={14} color={category.color} />
              <Text style={{ color: selected ? category.color : theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
                {category.name}
              </Text>
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
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Create category</Text>
        </Pressable>
      </View>

      <Modal visible={creating} animationType="slide" transparent onRequestClose={() => setCreating(false)}>
        <NewCategoryForm
          appliesTo={appliesTo}
          onCancel={() => setCreating(false)}
          onSave={async (values) => {
            const id = await onCreate(values);
            onSelect(id);
            setCreating(false);
          }}
        />
      </Modal>
    </View>
  );
}

function NewCategoryForm({
  appliesTo,
  onCancel,
  onSave,
}: {
  appliesTo: CategoryAppliesTo;
  onCancel: () => void;
  onSave: (values: { name: string; icon: string; color: string; appliesTo: CategoryAppliesTo }) => Promise<void>;
}) {
  const theme = useAppTheme();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_OPTIONS[0]);
  const [color, setColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);
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
          New category
        </Text>
        <TextField label="Name" placeholder="e.g. Side project" value={name} onChangeText={setName} autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Icon</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {CATEGORY_ICON_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setIcon(option)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: icon === option ? `${color}33` : theme.colors.background,
                  borderWidth: 1,
                  borderColor: icon === option ? color : theme.colors.border,
                }}>
                <Ionicons name={option as never} size={18} color={icon === option ? color : theme.colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {CATEGORY_COLOR_OPTIONS.map((option) => (
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
                await onSave({ name: name.trim(), icon, color, appliesTo });
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
