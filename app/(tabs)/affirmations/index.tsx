import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ImageBackground, Pressable, Text, View } from 'react-native';

import { Button, Card, LoadingState, ReminderCard, ScreenContainer } from '@/components';
import { backgroundFor, useAffirmations, type Affirmation } from '@/modules/affirmations';
import { useModuleReminders } from '@/modules/reminders';
import { useAppTheme } from '@/theme';

export default function AffirmationsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { affirmations, loading, todaysAffirmation, favorites, toggleFavorite } = useAffirmations();
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders(
    'affirmations',
    'Your daily affirmation',
    'Take a moment to reflect on something positive.'
  );
  const [displayed, setDisplayed] = useState<Affirmation | null>(null);

  useEffect(() => {
    if (todaysAffirmation && !displayed) {
      setDisplayed(todaysAffirmation);
    }
  }, [todaysAffirmation, displayed]);

  const onShuffle = () => {
    if (affirmations.length < 2) return;
    let next = displayed;
    while (!next || next.id === displayed?.id) {
      next = affirmations[Math.floor(Math.random() * affirmations.length)];
    }
    setDisplayed(next);
  };

  if (loading || !displayed) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/affirmations/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.moduleJournal} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <ImageBackground
          source={backgroundFor(displayed.id, displayed.text)}
          imageStyle={{ borderRadius: theme.radius.lg }}
          style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.28)', padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <Text style={{ color: '#fff', fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.semibold, lineHeight: 30 }}>
              “{displayed.text}”
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={onShuffle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="shuffle" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Shuffle</Text>
              </Pressable>
              <Pressable onPress={() => toggleFavorite(displayed)} hitSlop={8}>
                <Ionicons
                  name={displayed.is_favorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={displayed.is_favorite ? theme.colors.danger : '#fff'}
                />
              </Pressable>
            </View>
          </View>
        </ImageBackground>

        {reminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            state={reminder}
            onSave={(next) => saveReminder(reminder.id, next)}
            onRemove={reminders.length > 1 ? () => removeReminder(reminder.id) : undefined}
            color={theme.colors.moduleJournal}
          />
        ))}
        <Button label={reminders.length > 0 ? 'Add another reminder' : 'Add a reminder'} variant="secondary" onPress={addReminder} />

        {favorites.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              Favorites
            </Text>
            {favorites.slice(0, 5).map((affirmation) => (
              <Card key={affirmation.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.sm }}>
                <ImageBackground
                  source={backgroundFor(affirmation.id, affirmation.text)}
                  imageStyle={{ borderRadius: theme.radius.sm }}
                  style={{ width: 36, height: 36, borderRadius: theme.radius.sm, overflow: 'hidden' }}
                />
                <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{affirmation.text}</Text>
                <Pressable onPress={() => toggleFavorite(affirmation)} hitSlop={8}>
                  <Ionicons name="heart" size={18} color={theme.colors.danger} />
                </Pressable>
              </Card>
            ))}
          </View>
        ) : null}

        <Pressable onPress={() => router.push('/affirmations/all')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Ionicons name="list" size={20} color={theme.colors.textSecondary} />
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Browse all ({affirmations.length})
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Card>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
