import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingState, RowActionsMenu, ScreenContainer, TextField } from '@/components';
import { useFinanceLabels } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const COLORS = ['#8E8E93', '#3D8BFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'];

export default function LabelsScreen() {
  const theme = useAppTheme();
  const { labels, loading, addLabel, editLabel, removeLabel } = useFinanceLabels();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  const startEdit = (label: { id: string; name: string; color: string }) => {
    setEditingId(label.id);
    setName(label.name);
    setColor(label.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setColor(COLORS[0]);
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await editLabel(editingId, name.trim(), color);
      } else {
        await addLabel(name.trim(), color);
      }
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Labels
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            Free-form tags for transactions, independent of category
          </Text>
        </View>

        <Card style={{ gap: theme.spacing.md }}>
          <TextField placeholder="Label name" value={name} onChangeText={setName} />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {COLORS.map((option) => (
              <Pressable key={option} onPress={() => setColor(option)}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: option,
                    borderWidth: color === option ? 3 : 0,
                    borderColor: theme.colors.textPrimary,
                  }}
                />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {editingId ? (
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="ghost" onPress={cancelEdit} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Button label={editingId ? 'Save changes' : 'Add label'} onPress={onSubmit} disabled={!name.trim()} loading={saving} />
            </View>
          </View>
        </Card>

        {labels.length === 0 ? (
          <EmptyState icon="pricetag-outline" title="No labels yet" />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {labels.map((label) => (
              <Card key={label.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: label.color }} />
                <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                  {label.name}
                </Text>
                <RowActionsMenu itemLabel={label.name} onEdit={() => startEdit(label)} onDelete={() => removeLabel(label.id)} />
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
