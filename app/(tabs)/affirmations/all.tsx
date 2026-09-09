import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Button, Card, EmptyState, IconBadge, RowActionsMenu, ScreenContainer, TextField } from '@/components';
import { useAffirmations } from '@/modules/affirmations';
import type { Affirmation } from '@/modules/affirmations';
import { useAppTheme } from '@/theme';

function EditAffirmationSheet({
  affirmation,
  onClose,
  onSave,
}: {
  affirmation: Affirmation | null;
  onClose: () => void;
  onSave: (id: number, text: string) => Promise<void>;
}) {
  const theme = useAppTheme();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (affirmation) setText(affirmation.text);
  }, [affirmation]);

  return (
    <Modal visible={!!affirmation} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.md,
          }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            Edit affirmation
          </Text>
          <TextField value={text} onChangeText={setText} multiline numberOfLines={3} autoFocus />
          <Button
            label="Save changes"
            disabled={!text.trim()}
            loading={saving}
            onPress={async () => {
              if (!affirmation) return;
              setSaving(true);
              await onSave(affirmation.id, text.trim());
              setSaving(false);
              onClose();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function AllAffirmationsScreen() {
  const theme = useAppTheme();
  const { affirmations, toggleFavorite, editCustom, removeCustom } = useAffirmations();
  const [query, setQuery] = useState('');
  const [editingAffirmation, setEditingAffirmation] = useState<Affirmation | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return affirmations;
    return affirmations.filter((a) => a.text.toLowerCase().includes(q));
  }, [affirmations, query]);

  return (
    <ScreenContainer scroll={false}>
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            backgroundColor: theme.colors.background,
            borderRadius: theme.radius.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: theme.spacing.md,
          }}>
          <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${affirmations.length} affirmations...`}
            placeholderTextColor={theme.colors.textTertiary}
            style={{ flex: 1, paddingVertical: theme.spacing.md, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}
          />
        </View>

        {results.length === 0 ? (
          <EmptyState icon="search-outline" title="No affirmations found" subtitle="Try a different search." />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xl }}
            renderItem={({ item: affirmation }) => (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.sm }}>
                <IconBadge name="sparkles" color={theme.colors.moduleJournal} size="sm" shape="square" />
                <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{affirmation.text}</Text>
                <Pressable onPress={() => toggleFavorite(affirmation)} hitSlop={8}>
                  <Ionicons
                    name={affirmation.is_favorite ? 'heart' : 'heart-outline'}
                    size={18}
                    color={affirmation.is_favorite ? theme.colors.danger : theme.colors.textTertiary}
                  />
                </Pressable>
                {/* Only user-created affirmations can be edited/deleted — the built-in set has no
                    re-seed path if one were accidentally removed. */}
                {affirmation.is_custom ? (
                  <RowActionsMenu
                    itemLabel="affirmation"
                    onEdit={() => setEditingAffirmation(affirmation)}
                    onDelete={() => removeCustom(affirmation.id)}
                  />
                ) : null}
              </Card>
            )}
          />
        )}
      </View>
      <EditAffirmationSheet affirmation={editingAffirmation} onClose={() => setEditingAffirmation(null)} onSave={editCustom} />
    </ScreenContainer>
  );
}
