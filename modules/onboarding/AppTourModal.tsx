import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components';
import { useAppTheme } from '@/theme';

const TOUR_SEEN_KEY = 'app-tour-seen-v1';

type Slide = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

const SLIDES: Slide[] = [
  {
    icon: 'sparkles',
    title: 'Meet your AI Assistant',
    body: 'The floating sparkle button follows you everywhere. Drag it anywhere on screen, tap it for suggestions based on your mood, goals, and budget.',
  },
  {
    icon: 'barbell',
    title: 'Exercise Library',
    body: 'Browse exercises by category, muscle, or equipment. Log sets and track your progress over time — from Workout Tracker.',
  },
  {
    icon: 'water',
    title: 'Water Tracker',
    body: "New tracker under More — logs your daily water intake with a goal suggested from your body weight.",
  },
  {
    icon: 'restaurant',
    title: 'Smarter food logging',
    body: 'Search Indian dishes and packaged foods, or scan a barcode with your camera, right from Log Food.',
  },
];

/** Shown once, ever, after this batch of features shipped — gated on a persisted flag so it never
 * reappears once dismissed. Mounted at the (tabs) layout root, same place as the AI assistant FAB. */
export function AppTourModal() {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_SEEN_KEY).then((seen) => {
      if (!seen) setVisible(true);
    });
  }, []);

  const dismiss = () => {
    AsyncStorage.setItem(TOUR_SEEN_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: theme.colors.overlay, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.spacing.xl, width: '100%', gap: theme.spacing.lg }}>
          <Pressable onPress={dismiss} style={{ position: 'absolute', top: theme.spacing.md, right: theme.spacing.md, zIndex: 1 }} hitSlop={8}>
            <Ionicons name="close" size={22} color={theme.colors.textTertiary} />
          </Pressable>

          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: theme.colors.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
            }}>
            <Ionicons name={slide.icon} size={28} color={theme.colors.primary} />
          </View>

          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
            {slide.title}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center', lineHeight: 20 }}>{slide.body}</Text>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === index ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === index ? theme.colors.primary : theme.colors.border,
                }}
              />
            ))}
          </View>

          <Button label={isLast ? 'Got it' : 'Next'} onPress={() => (isLast ? dismiss() : setIndex((i) => i + 1))} />
        </View>
      </View>
    </Modal>
  );
}
