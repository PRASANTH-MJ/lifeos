import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components';
import { useAppTheme } from '@/theme';

type ModuleHref = '/calendar' | '/meditation' | '/breathing' | '/affirmations' | '/finance' | '/food' | '/mind-training' | '/workout' | '/timer' | '/shopping' | '/settings' | '/analytics';

type ModuleLink = {
  href: ModuleHref;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  mutedColor: string;
};

type Section = {
  title: string | null;
  modules: ModuleLink[];
};

export default function MoreScreen() {
  const theme = useAppTheme();

  const sections: Section[] = [
    {
      title: 'Mindfulness & Wellness',
      modules: [
        {
          href: '/meditation',
          icon: 'moon',
          title: 'Meditation',
          subtitle: 'Guided sessions and timed sits',
          color: theme.colors.moduleJournal,
          mutedColor: theme.colors.moduleJournalMuted,
        },
        {
          href: '/breathing',
          icon: 'pulse',
          title: 'Breathing',
          subtitle: 'Box breathing, 4-7-8, and more',
          color: theme.colors.moduleTasks,
          mutedColor: theme.colors.moduleTasksMuted,
        },
        {
          href: '/affirmations',
          icon: 'sunny',
          title: 'Affirmations',
          subtitle: 'A daily affirmation, favorites, and your own',
          color: theme.colors.moduleJournal,
          mutedColor: theme.colors.moduleJournalMuted,
        },
        {
          href: '/mind-training',
          icon: 'bulb',
          title: 'Mind Training',
          subtitle: 'Reaction time, memory, and focus exercises',
          color: theme.colors.primary,
          mutedColor: theme.colors.primaryMuted,
        },
      ],
    },
    {
      title: 'Health & Body',
      modules: [
        {
          href: '/food',
          icon: 'restaurant',
          title: 'Food',
          subtitle: 'Meals, calories, and macros by day',
          color: theme.colors.moduleTasks,
          mutedColor: theme.colors.moduleTasksMuted,
        },
        {
          href: '/workout',
          icon: 'barbell',
          title: 'Workouts',
          subtitle: "Today's recommendation based on your goals",
          color: theme.colors.moduleTasks,
          mutedColor: theme.colors.moduleTasksMuted,
        },
      ],
    },
    {
      title: 'Tools & Management',
      modules: [
        {
          href: '/analytics',
          icon: 'stats-chart',
          title: 'Insights',
          subtitle: 'Cross-module analytics: habits, tasks, mood, finance',
          color: theme.colors.primary,
          mutedColor: theme.colors.primaryMuted,
        },
        {
          href: '/calendar',
          icon: 'calendar',
          title: 'Calendar',
          subtitle: 'Habits, tasks, and events in one view',
          color: theme.colors.primary,
          mutedColor: theme.colors.primaryMuted,
        },
        {
          href: '/finance',
          icon: 'cash',
          title: 'Finance',
          subtitle: 'Income, expenses, and monthly summaries',
          color: theme.colors.primary,
          mutedColor: theme.colors.primaryMuted,
        },
        {
          href: '/shopping',
          icon: 'cart',
          title: 'Shopping List',
          subtitle: 'Quick items to pick up, checked off as you go',
          color: theme.colors.moduleTasks,
          mutedColor: theme.colors.moduleTasksMuted,
        },
        {
          href: '/timer',
          icon: 'timer',
          title: 'Timer',
          subtitle: 'Stopwatch or countdown, standalone or per habit',
          color: theme.colors.primary,
          mutedColor: theme.colors.primaryMuted,
        },
      ],
    },
    {
      title: null,
      modules: [
        {
          href: '/settings',
          icon: 'settings-outline',
          title: 'Settings',
          subtitle: 'Time format and app preferences',
          color: theme.colors.textSecondary,
          mutedColor: theme.colors.border,
        },
      ],
    },
  ];

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.size['3xl'],
            fontWeight: theme.typography.weight.bold,
          }}>
          More
        </Text>
        {sections.map((section, index) => (
          <View key={section.title ?? `section-${index}`} style={{ gap: theme.spacing.md }}>
            {section.title ? (
              <Text
                style={{
                  color: theme.colors.textTertiary,
                  fontSize: theme.typography.size.xs,
                  fontWeight: theme.typography.weight.semibold,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                {section.title}
              </Text>
            ) : null}
            {section.modules.map((mod) => (
              <Link key={mod.href} href={mod.href} asChild>
                <Pressable>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: theme.radius.md,
                        backgroundColor: mod.mutedColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name={mod.icon} size={22} color={mod.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: theme.colors.textPrimary,
                          fontSize: theme.typography.size.base,
                          fontWeight: theme.typography.weight.semibold,
                        }}>
                        {mod.title}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                        {mod.subtitle}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}
