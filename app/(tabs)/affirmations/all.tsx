import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, ImageBackground, Pressable, Text, TextInput, View } from 'react-native';

import { Card, EmptyState, ScreenContainer } from '@/components';
import { backgroundFor, useAffirmations } from '@/modules/affirmations';
import { useAppTheme } from '@/theme';

export default function AllAffirmationsScreen() {
  const theme = useAppTheme();
  const { affirmations, toggleFavorite } = useAffirmations();
  const [query, setQuery] = useState('');

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
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.md,
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
                <ImageBackground
                  source={backgroundFor(affirmation.id, affirmation.text)}
                  imageStyle={{ borderRadius: theme.radius.sm }}
                  style={{ width: 36, height: 36, borderRadius: theme.radius.sm, overflow: 'hidden' }}
                />
                <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{affirmation.text}</Text>
                <Pressable onPress={() => toggleFavorite(affirmation)} hitSlop={8}>
                  <Ionicons
                    name={affirmation.is_favorite ? 'heart' : 'heart-outline'}
                    size={18}
                    color={affirmation.is_favorite ? theme.colors.danger : theme.colors.textTertiary}
                  />
                </Pressable>
              </Card>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
