import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components';
import { FOOD_DATA_LICENSE_NOTICE } from '@/modules/food';
import { useAppTheme } from '@/theme';

const EXERCISE_DATA_NOTICE = 'Exercise data from wger.de, CC BY-SA 4.0';

type FaqItem = { question: string; answer: string };
type FaqSection = { title: string; icon: keyof typeof Ionicons.glyphMap; items: FaqItem[] };

const SECTIONS: FaqSection[] = [
  {
    title: 'Habits & Tasks',
    icon: 'flame',
    items: [
      { question: 'How do I log a habit or task?', answer: 'Tap it on the Today screen to open the quick-log popup, or tap the checkbox next to it in the Habits/Tasks tab.' },
      { question: 'Where do I see my streak and stats?', answer: 'Open the habit or task from the Habits/Tasks tab (not Today) to see its Calendar, Statistics, and Edit tabs.' },
    ],
  },
  {
    title: 'Exercise Library',
    icon: 'barbell',
    items: [
      { question: 'How do I find exercises for a specific muscle?', answer: 'In Workout Tracker → Exercise Library, use the Category / Muscle / Equipment toggle above the search bar.' },
      { question: 'How do I track my progress on an exercise?', answer: 'Open any exercise and use "Log a set" — your History and Progress tabs build up from there.' },
    ],
  },
  {
    title: 'Food Tracker',
    icon: 'restaurant',
    items: [
      { question: 'Can I search for Indian dishes?', answer: 'Yes — Log Food → Search covers common Indian dishes (dosa, idli, biryani, etc.) plus packaged foods.' },
      { question: 'What does the quantity field do?', answer: 'After picking a search result, enter grams (packaged foods) or number of servings (Indian dishes) to scale the nutrition to your actual portion.' },
    ],
  },
  {
    title: 'Water Tracker',
    icon: 'water',
    items: [
      { question: 'How is my daily goal calculated?', answer: 'If you set your weight in onboarding, we suggest a goal based on it. You can always set your own from the Water Tracker screen.' },
    ],
  },
  {
    title: 'Finance Tracker',
    icon: 'cash',
    items: [
      { question: 'Why does a category get auto-selected sometimes?', answer: 'Typing a note like "Swiggy" or "Uber" auto-suggests a matching category. You can always override it by tapping a different one.' },
      { question: 'What\'s the difference between Budgets and Budget Plans?', answer: 'The quick weekly/monthly budget on the Finance home screen is one overall number. Budget Plans (its own screen) let you set separate budgets per category or period.' },
      { question: 'How do I change the default currency for new accounts?', answer: 'Go to Settings → Currency and pick a default. Existing accounts keep whatever currency they were created with — Flowsy does not convert between currencies.' },
    ],
  },
  {
    title: 'Cardio & GPS Tracking',
    icon: 'walk',
    items: [
      { question: 'How do I record a run, walk, or ride with a live map?', answer: 'Open Fitness → Cardio, pick an activity, and tap Record. Your route is tracked live and shown on a map even while the app is in the background.' },
      { question: 'Can I share my route after finishing?', answer: 'Yes — after saving, choose a photo/route template (Minimal, Bold, Gradient, or Map) or post it as an animated GIF that replays your route.' },
    ],
  },
  {
    title: 'Social Feed & Clubs',
    icon: 'people',
    items: [
      { question: 'Do I need a username to use Flowsy?', answer: 'No — a username is only needed to use the Social feed (posting, following, clubs). Every other module works fully without one.' },
      { question: 'What are Clubs?', answer: 'A Club is a small group you create or join to share habits, tasks, challenges, and events with — think of it as accountability with friends or family, separate from your personal Habits/Tasks.' },
      { question: 'How do I remove old completed items from a Club?', answer: 'Open the club\'s Habits or Tasks screen and use the "⋮" menu on any item to Archive it — it moves to the Archived tab instead of cluttering the active list.' },
    ],
  },
  {
    title: 'Family Plan',
    icon: 'people-circle',
    items: [
      { question: 'How does the Family plan work?', answer: 'One subscription covers up to 5 accounts. The owner invites members from Settings → Family Plan; each member keeps their own private data and gets full Pro access.' },
      { question: 'What happens if I leave or get removed from a family?', answer: 'You revert to the free plan and its usage limits. Nothing you\'ve entered in the app is deleted.' },
    ],
  },
  {
    title: 'AI Assistant',
    icon: 'sparkles',
    items: [
      { question: 'What is the floating sparkle button?', answer: 'It opens a page with suggestions based on your mood, goals, and budget — breathing/meditation picks, water reminders, and food/workout/finance tips.' },
      { question: 'Can I move it?', answer: 'Yes — drag it anywhere on screen. It remembers where you leave it.' },
    ],
  },
  {
    title: 'Premium',
    icon: 'star',
    items: [
      {
        question: 'What does Premium unlock?',
        answer:
          'Unlimited habits, tasks, journal entries, finance accounts/transactions, and custom workouts (the free plan caps these), plus cloud backup & restore, custom themes, workout analytics & muscle recovery, and the full meal plan and workout program libraries.',
      },
      {
        question: "I paid but Premium isn't unlocked — what do I do?",
        answer:
          'Flowsy verifies your purchase on our server right after checkout — this can take a few seconds. If it still hasn\'t unlocked, open Premium and tap "Restore Purchases" to re-check for an active purchase.',
      },
      {
        question: 'How do I cancel or manage my subscription?',
        answer:
          "If you subscribed through the Android app, it's billed and managed by Google Play — open the Play Store app, go to Payments & subscriptions, and manage Flowsy from there. If you subscribed on the Flowsy website, it's billed through Razorpay — email us and we'll cancel it for you (see our Refund & Cancellation Policy).",
      },
    ],
  },
];

export default function HelpScreen() {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }} style={{ backgroundColor: theme.colors.background }}>
      {SECTIONS.map((section) => (
        <View key={section.title} style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name={section.icon} size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
              {section.title}
            </Text>
          </View>
          {section.items.map((item) => {
            const key = `${section.title}-${item.question}`;
            const isOpen = expanded.has(key);
            return (
              <Pressable key={key} onPress={() => toggle(key)}>
                <Card style={{ gap: theme.spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium, flex: 1 }}>
                      {item.question}
                    </Text>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textTertiary} />
                  </View>
                  {isOpen ? (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>{item.answer}</Text>
                  ) : null}
                </Card>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
            Data Sources
          </Text>
        </View>
        <Card style={{ gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>{FOOD_DATA_LICENSE_NOTICE}</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>{EXERCISE_DATA_NOTICE}</Text>
        </Card>
      </View>

      <Card style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
          Still stuck, or found a bug?
        </Text>
        <Pressable onPress={() => Linking.openURL('mailto:data24zone@gmail.com')}>
          <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Email data24zone@gmail.com
          </Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}
