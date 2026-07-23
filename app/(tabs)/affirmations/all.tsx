import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, Pressable, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components';
import { backgroundFor, useAffirmations } from '@/modules/affirmations';
import { useAppTheme } from '@/theme';

export default function AllAffirmationsScreen() {
  const theme = useAppTheme();
  const { affirmations, toggleFavorite } = useAffirmations();

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.sm }}>
        {affirmations.map((affirmation) => (
          <Card key={affirmation.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.sm }}>
            <ImageBackground
              source={backgroundFor(affirmation.id)}
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
        ))}
      </View>
    </ScreenContainer>
  );
}
