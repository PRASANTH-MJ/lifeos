import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, IconBadge, ScreenContainer, useTabSwipeNavigation } from '@/components';
import { LATEST_CHANGELOG_VERSION } from '@/modules/changelog';
import { useSettings } from '@/modules/settings';
import { useAppTheme } from '@/theme';

type ModuleHref =
  | '/habits'
  | '/tasks'
  | '/journal'
  | '/calendar'
  | '/meditation'
  | '/breathing'
  | '/affirmations'
  | '/food'
  | '/mind-training'
  | '/workout'
  | '/water'
  | '/cardio'
  | '/timer'
  | '/shopping'
  | '/settings'
  | '/analytics'
  | '/scoreboard'
  | '/changelog';

type ModuleLink = {
  href: ModuleHref;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  /** Small unread-style dot on the icon badge — currently only used by the "What's New" row
   * (see hasUnseenChangelog below), same on/off shape as useNotifications' unreadCount badge. */
  showDot?: boolean;
};

type Section = {
  title: string | null;
  modules: ModuleLink[];
};

export default function MoreScreen() {
  const theme = useAppTheme();
  const swipeHandlers = useTabSwipeNavigation('/more');
  const { settings } = useSettings();
  const hasUnseenChangelog = settings != null && settings.lastSeenChangelogVersion !== LATEST_CHANGELOG_VERSION;

  const sections: Section[] = [
    {
      // Habits, Tasks, and Journal used to be their own tab bar tabs — they moved here when
      // those slots were repurposed for the Health & Fitness and Mindfulness tabs (see
      // _layout.tsx); this is now the only direct path to each one's full list/detail screens.
      title: 'Productivity',
      modules: [
        {
          href: '/habits',
          icon: 'flame',
          title: 'Habits',
          subtitle: 'Streaks, reminders, and daily tracking',
          color: theme.colors.primary,
        },
        {
          href: '/tasks',
          icon: 'checkbox',
          title: 'Tasks',
          subtitle: 'One-time and recurring to-dos',
          color: theme.colors.moduleTasks,
        },
        {
          href: '/journal',
          icon: 'book',
          title: 'Journal',
          subtitle: 'Free-write entries and past check-ins',
          color: theme.colors.moduleJournal,
        },
      ],
    },
    {
      title: 'Mindfulness & Wellness',
      modules: [
        {
          href: '/meditation',
          icon: 'moon',
          title: 'Meditation',
          subtitle: 'Guided sessions and timed sits',
          color: theme.colors.moduleJournal,
        },
        {
          href: '/breathing',
          icon: 'pulse',
          title: 'Breathing',
          subtitle: 'Box breathing, 4-7-8, and more',
          color: theme.colors.moduleTasks,
        },
        {
          href: '/affirmations',
          icon: 'sunny',
          title: 'Affirmations',
          subtitle: 'A daily affirmation, favorites, and your own',
          color: theme.colors.moduleJournal,
        },
        {
          href: '/mind-training',
          icon: 'bulb',
          title: 'Mind Training',
          subtitle: 'Reaction time, memory, and focus exercises',
          color: theme.colors.primary,
        },
      ],
    },
    {
      title: 'Health & Body',
      modules: [
        {
          href: '/food',
          icon: 'restaurant',
          title: 'Food Tracker',
          subtitle: 'Meals, calories, and macros by day',
          color: theme.colors.moduleTasks,
        },
        {
          href: '/workout',
          icon: 'barbell',
          title: 'Workout Tracker',
          subtitle: "Today's recommendation based on your goals",
          color: theme.colors.moduleTasks,
        },
        {
          href: '/water',
          icon: 'water',
          title: 'Water Tracker',
          subtitle: 'Log your daily water intake',
          color: theme.colors.moduleTasks,
        },
        {
          href: '/cardio',
          icon: 'walk',
          title: 'Activity Tracker',
          subtitle: 'Running, walking, hiking, yoga, and sports — with levels',
          color: theme.colors.moduleTasks,
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
        },
        {
          href: '/scoreboard',
          icon: 'podium-outline',
          title: 'Life Scoreboard',
          subtitle: 'Physical, mental, spiritual, financial, and relationship balance',
          color: theme.colors.warning,
        },
        {
          href: '/calendar',
          icon: 'calendar',
          title: 'Calendar',
          subtitle: 'Habits, tasks, and events in one view',
          color: theme.colors.primary,
        },
        {
          href: '/shopping',
          icon: 'cart',
          title: 'Shopping List',
          subtitle: 'Quick items to pick up, checked off as you go',
          color: theme.colors.moduleTasks,
        },
        {
          href: '/timer',
          icon: 'timer',
          title: 'Timer',
          subtitle: 'Stopwatch or countdown, standalone or per habit',
          color: theme.colors.primary,
        },
      ],
    },
    {
      title: null,
      modules: [
        {
          href: '/settings',
          icon: 'settings-outline',
          title: 'Settings and Profile',
          subtitle: 'Time format and app preferences',
          color: theme.colors.textSecondary,
        },
        {
          href: '/changelog',
          icon: 'sparkles-outline',
          title: "What's New",
          subtitle: 'Recent additions to Flowsy',
          color: theme.colors.primary,
          showDot: hasUnseenChangelog,
        },
      ],
    },
  ];

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
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
          <View key={section.title ?? `section-${index}`} style={{ gap: theme.spacing.sm }}>
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
            <Card tier="panel" style={{ gap: theme.spacing.sm }}>
              {section.modules.map((mod) => (
                <Link key={mod.href} href={mod.href} asChild>
                  <Pressable>
                    <Card tier="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <View style={{ position: 'relative' }}>
                        <IconBadge name={mod.icon} color={mod.color} size="md" />
                        {mod.showDot ? (
                          <View
                            style={{
                              position: 'absolute',
                              top: -1,
                              right: -1,
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: theme.colors.danger,
                              borderWidth: 1.5,
                              borderColor: theme.colors.surfaceElevated,
                            }}
                          />
                        ) : null}
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
            </Card>
          </View>
        ))}
      </View>
    </ScreenContainer>
    </View>
  );
}
