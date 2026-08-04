import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, PanResponder, Pressable, Text, View } from 'react-native';

import { Button, Card, GlowSurface, LoadingState, ReminderCard, ScreenContainer } from '@/components';
import { backgroundFor, useAffirmations } from '@/modules/affirmations';
import { useModuleReminders } from '@/modules/reminders';
import { useAppTheme } from '@/theme';

const SLIDE_DISTANCE = 36;
const TRANSITION_MS = 260;

export default function AffirmationsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { affirmations, loading, todaysAffirmation, favorites, toggleFavorite } = useAffirmations();
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders(
    'affirmations',
    'Your daily affirmation',
    'Take a moment to reflect on something positive.'
  );

  const [index, setIndex] = useState<number | null>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  // Breathing pacer — a slow, endless scale pulse behind the affirmation text.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  useEffect(() => {
    if (todaysAffirmation && index === null) {
      const startIndex = affirmations.findIndex((a) => a.id === todaysAffirmation.id);
      setIndex(startIndex >= 0 ? startIndex : 0);
    }
  }, [todaysAffirmation, affirmations, index]);

  const goTo = (nextIndex: number, incomingFrom: 'left' | 'right') => {
    if (affirmations.length === 0) return;
    const wrapped = ((nextIndex % affirmations.length) + affirmations.length) % affirmations.length;
    fade.setValue(0);
    slide.setValue(incomingFrom === 'right' ? SLIDE_DISTANCE : -SLIDE_DISTANCE);
    setIndex(wrapped);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: TRANSITION_MS, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: TRANSITION_MS, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderMove: () => {},
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_evt, gesture) => {
          if (index === null) return;
          if (gesture.dx < 0) {
            goTo(index + 1, 'right');
          } else if (gesture.dx > 0) {
            goTo(index - 1, 'left');
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, affirmations.length]
  );

  const onShuffle = () => {
    if (affirmations.length < 2 || index === null) return;
    let next = index;
    while (next === index) {
      next = Math.floor(Math.random() * affirmations.length);
    }
    goTo(next, 'right');
  };

  if (loading || index === null || affirmations.length === 0) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const displayed = affirmations[index];

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
        <View {...panResponder.panHandlers}>
          <ImageBackground
            source={backgroundFor(displayed.id, displayed.text)}
            imageStyle={{ borderRadius: theme.radius.lg }}
            style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.28)', padding: theme.spacing.lg, gap: theme.spacing.lg }}>
              <View style={{ position: 'relative' }}>
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    alignSelf: 'center',
                    top: '50%',
                    marginTop: -70,
                    transform: [{ scale: breathScale }],
                  }}>
                  <GlowSurface color={theme.colors.glow} intensity="lg" borderRadius={70}>
                    <View style={{ width: 140, height: 140 }} />
                  </GlowSurface>
                </Animated.View>
                <Animated.Text
                  style={{
                    color: '#fff',
                    fontSize: theme.typography.size.xl,
                    fontWeight: theme.typography.weight.semibold,
                    lineHeight: 30,
                    opacity: fade,
                    transform: [{ translateX: slide }],
                  }}>
                  “{displayed.text}”
                </Animated.Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pressable onPress={onShuffle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="shuffle" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Shuffle</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {affirmations.length > 1
                    ? affirmations.slice(0, 8).map((a, i) => (
                        <View
                          key={a.id}
                          style={{
                            width: i === index ? 14 : 5,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.4)',
                          }}
                        />
                      ))
                    : null}
                </View>
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
        </View>

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
