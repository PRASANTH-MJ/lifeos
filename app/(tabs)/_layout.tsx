import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { GlowSurface } from '@/components';
import { FLOATING_TAB_BAR_HEIGHT, FLOATING_TAB_BAR_MARGIN } from '@/components/tabBarMetrics';
import { useAppTheme, type AppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

function renderTabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => {
    const icon = <Ionicons name={name} color={color} size={size} />;
    if (!focused) return icon;
    return (
      <GlowSurface color={String(color)} intensity="sm" borderRadius={size}>
        {icon}
      </GlowSurface>
    );
  };
}

export default function TabsLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: floatingTabBarStyle(theme),
        tabBarItemStyle: { paddingTop: 6 },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.textPrimary,
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: renderTabIcon('today'),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          headerShown: false,
          tabBarIcon: renderTabIcon('flame'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          headerShown: false,
          tabBarIcon: renderTabIcon('checkbox'),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          headerShown: false,
          tabBarIcon: renderTabIcon('book'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: renderTabIcon('grid'),
        }}
      />
      {/* Reachable via the "More" hub, not shown as their own tab bar buttons — */}
      {/* href: null keeps the route (and its Stack) registered without a tab icon. */}
      <Tabs.Screen name="analytics" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="calendar" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="meditation" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="breathing" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="affirmations" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="finance" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="food" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="mind-training" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="workout" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="timer" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="shopping" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="settings" options={{ headerShown: false, href: null }} />
    </Tabs>
  );
}

/** Floating, translucent, pill-shaped bar — the app has no real blur (see GlowSurface's own
 * comment), so "translucent" here is a tinted semi-transparent surface color, not a literal
 * backdrop blur. FLOATING_TAB_BAR_HEIGHT/MARGIN also drive ScreenContainer's bottom clearance,
 * so scrollable content never ends up hidden behind this bar. */
function floatingTabBarStyle(theme: AppTheme) {
  return {
    position: 'absolute' as const,
    left: FLOATING_TAB_BAR_MARGIN,
    right: FLOATING_TAB_BAR_MARGIN,
    bottom: FLOATING_TAB_BAR_MARGIN,
    height: FLOATING_TAB_BAR_HEIGHT,
    borderRadius: theme.radius.xl,
    backgroundColor: withAlpha(theme.colors.surfaceElevated, 0.86),
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.md,
  };
}
