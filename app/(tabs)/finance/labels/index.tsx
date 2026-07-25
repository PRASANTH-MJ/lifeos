import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingState, ScreenContainer, TextField } from '@/components';
import { useFinanceLabels } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const COLORS = ['#8E8E93', '#3D8BFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'];

export default function LabelsScreen() {
  const theme = useAppTheme();
  const { labels, loading, addLabel, removeLabel } = useFinanceLabels();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  const onAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addLabel(name.trim(), color);
      setName('');
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
          <TextField placeholder="New label name" value={name} onChangeText={setName} />
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
          <Button label="Add label" onPress={onAdd} disabled={!name.trim()} loading={saving} />
        </Card>

        {labels.length === 0 ? (
          <EmptyState icon="pricetag-outline" title="No labels yet" />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {labels.map((label) => (
              <Card key={label.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: label.color }} />
                <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                  {label.name}
                </Text>
                <Pressable onPress={() => removeLabel(label.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                </Pressable>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
