import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components';
import { useAppTheme } from '@/theme';

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
      { question: 'How does barcode scanning work?', answer: 'Tap the barcode icon next to search, point your camera at a packaged food\'s barcode, and it auto-fills the nutrition.' },
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
      { question: 'What does Premium unlock?', answer: 'Cloud backup & restore, custom themes, and higher usage limits on habits/tasks/journal entries.' },
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
