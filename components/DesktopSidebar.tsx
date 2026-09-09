import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { Href } from 'expo-router';

import { IconBadge } from './IconBadge';
import { shouldShowCycleTracking } from '@/modules/cycle';
import { useProfile } from '@/modules/profile';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

const SIDEBAR_WIDTH = 260;

type SubNavItem = {
  href: Href;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type NavItem = {
  href: '/' | '/health-fitness' | '/finance' | '/mindfulness-wellness' | '/social' | '/more';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  // Sub-routes (reached from within this section, e.g. via the hub screen or the More menu)
  // that should still highlight this item even though the URL no longer matches the href above.
  relatedPrefixes: string[];
  // Mirrors the module links each section's own hub screen already surfaces (health-fitness.tsx,
  // mindfulness-wellness.tsx, finance/index.tsx, more.tsx) — same destinations, just reachable
  // without detouring through the hub on a wide viewport.
  children?: SubNavItem[];
};

// Cycle Tracking's entry (and the /cycle relatedPrefix that keeps Fitness highlighted while on
// it) is appended conditionally — see buildNavItems — rather than always present, since it's
// gated the same way as its Fitness-hub counterpart (see health-fitness.tsx).
function buildNavItems(showCycleTracking: boolean): NavItem[] {
  return [
    {
      href: '/',
      label: 'Productivity',
      icon: 'today',
      relatedPrefixes: ['/habits', '/tasks', '/calendar', '/analytics'],
      children: [
        { href: '/habits', label: 'Habits', icon: 'flame' },
        { href: '/tasks', label: 'Tasks', icon: 'checkbox' },
        { href: '/calendar', label: 'Calendar', icon: 'calendar' },
        { href: '/analytics', label: 'Insights', icon: 'stats-chart' },
      ],
    },
    {
      href: '/health-fitness',
      label: 'Fitness',
      icon: 'barbell',
      relatedPrefixes: showCycleTracking ? ['/workout', '/food', '/water', '/cycle'] : ['/workout', '/food', '/water'],
      children: [
        { href: '/workout', label: 'Workout Tracker', icon: 'barbell' },
        { href: '/food', label: 'Food Tracker', icon: 'restaurant' },
        { href: '/water', label: 'Water Tracker', icon: 'water' },
        ...(showCycleTracking ? [{ href: '/cycle' as const, label: 'Cycle Tracking', icon: 'water-outline' as const }] : []),
      ],
    },
    {
      href: '/finance',
      label: 'Finance',
      icon: 'cash',
      relatedPrefixes: [],
      children: [
        { href: '/finance/records', label: 'Records', icon: 'list-outline' },
        { href: '/finance/budgets', label: 'Budgets', icon: 'bar-chart-outline' },
        { href: '/finance/goals', label: 'Goals', icon: 'flag-outline' },
        { href: '/finance/debts', label: 'Debts', icon: 'hand-left-outline' },
        { href: '/finance/planned', label: 'Planned payments', icon: 'time-outline' },
        { href: '/finance/labels', label: 'Labels', icon: 'pricetag-outline' },
        { href: '/finance/analytics', label: 'Analytics', icon: 'analytics-outline' },
      ],
    },
    {
      href: '/mindfulness-wellness',
      label: 'Mindfulness',
      icon: 'leaf',
      relatedPrefixes: ['/journal', '/meditation', '/breathing', '/mind-training', '/affirmations'],
      children: [
        { href: '/journal', label: 'Journal', icon: 'book' },
        { href: '/meditation', label: 'Meditation', icon: 'moon' },
        { href: '/breathing', label: 'Breathing', icon: 'pulse' },
        { href: '/mind-training', label: 'Mind Training', icon: 'bulb' },
        { href: '/affirmations', label: 'Affirmations', icon: 'sunny' },
      ],
    },
    {
      href: '/social',
      label: 'Feed',
      icon: 'globe',
      relatedPrefixes: [],
    },
    {
      href: '/more',
      label: 'More',
      icon: 'grid',
      relatedPrefixes: ['/settings', '/shopping', '/timer'],
      children: [
        { href: '/shopping', label: 'Shopping List', icon: 'cart' },
        { href: '/timer', label: 'Timer', icon: 'timer' },
        { href: '/settings', label: 'Settings and Profile', icon: 'settings-outline' },
      ],
    },
  ];
}

function isActive(pathname: string, item: NavItem) {
  if (item.href === '/') return pathname === '/';
  if (pathname === item.href || pathname.startsWith(item.href + '/')) return true;
  return item.relatedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function isChildActive(pathname: string, child: SubNavItem) {
  const href = String(child.href);
  return pathname === href || pathname.startsWith(href + '/');
}

/** A permanent left-hand nav for wide web viewports, replacing the floating bottom tab bar. It
 * navigates by URL (usePathname/useRouter) rather than reading the Tabs navigator's own state, so
 * it stays fully decoupled from <Tabs> — the tab bar (and its per-tab stack/history behavior) is
 * simply hidden via tabBarStyle on wide screens, not replaced or reimplemented. */
export function DesktopSidebar() {
  const theme = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile();
  const navItems = useMemo(() => buildNavItems(shouldShowCycleTracking(profile?.gender ?? null)), [profile?.gender]);

  return (
    <View
      style={{
        width: SIDEBAR_WIDTH,
        height: '100%',
        backgroundColor: theme.colors.surface,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.xs,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.sm, marginBottom: theme.spacing['2xl'] }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden' }}>
          <Image source={require('../assets/icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>Flowsy</Text>
      </View>

      {navItems.map((item) => {
        const active = isActive(pathname, item);
        return (
          <View key={item.href}>
            <Pressable
              onPress={() => router.navigate(item.href)}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.card,
                  borderLeftWidth: 3,
                  borderLeftColor: active ? theme.colors.primary : 'transparent',
                  backgroundColor: active ? withAlpha(theme.colors.primary, 0.14) : pressed ? theme.colors.surfaceElevated : 'transparent',
                },
              ]}>
              <IconBadge name={item.icon} size="sm" color={active ? theme.colors.primary : theme.colors.textTertiary} tone={active ? 'tinted' : 'neutral'} />
              <Text
                style={{
                  color: active ? theme.colors.primary : theme.colors.textSecondary,
                  fontSize: theme.typography.size.lg,
                  fontWeight: active ? theme.typography.weight.semibold : theme.typography.weight.medium,
                }}>
                {item.label}
              </Text>
            </Pressable>

            {active && item.children ? (
              <View style={{ gap: theme.spacing.xs / 2, marginTop: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
                {item.children.map((child) => {
                  const childActive = isChildActive(pathname, child);
                  return (
                    <Pressable
                      key={String(child.href)}
                      onPress={() => router.navigate(child.href)}
                      accessibilityRole="link"
                      accessibilityLabel={child.label}
                      accessibilityState={{ selected: childActive }}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: theme.spacing.sm,
                          paddingVertical: theme.spacing.xs,
                          paddingLeft: theme.spacing.xl + theme.spacing.xs,
                          paddingRight: theme.spacing.md,
                          borderRadius: theme.radius.md,
                          backgroundColor: childActive ? withAlpha(theme.colors.primary, 0.1) : pressed ? theme.colors.surfaceElevated : 'transparent',
                        },
                      ]}>
                      <Ionicons name={child.icon} size={15} color={childActive ? theme.colors.primary : theme.colors.textTertiary} />
                      <Text
                        style={{
                          color: childActive ? theme.colors.primary : theme.colors.textSecondary,
                          fontSize: theme.typography.size.sm,
                          fontWeight: childActive ? theme.typography.weight.semibold : theme.typography.weight.medium,
                        }}>
                        {child.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
