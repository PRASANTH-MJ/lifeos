import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Platform, useWindowDimensions, View } from 'react-native';

import { DesktopSidebar, GlowSurface } from '@/components';
import { FLOATING_TAB_BAR_HEIGHT, FLOATING_TAB_BAR_MARGIN, isFloatingTabBarHidden } from '@/components/tabBarMetrics';
import { AppTourModal } from '@/modules/onboarding';
import { usePublicProfileStatsSync } from '@/modules/social';
import { AiAssistantFab } from '@/modules/recommendations';
import { useDefaultCheckinReminders } from '@/modules/reminders';
import { useAppTheme, type AppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

const DESKTOP_BREAKPOINT = 768;

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
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  // A permanent left sidebar replaces the floating bottom bar on wide web viewports — it
  // navigates by URL independently of <Tabs> (see DesktopSidebar), so the tab bar itself is just
  // hidden here rather than removed, keeping every tab's own stack/history behavior intact.
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const hideTabBar = isFloatingTabBarHidden(pathname);
  // The AI Assistant FAB used to float on every single screen, which meant it permanently
  // overlapped whatever the last row of any long list happened to be (confirmed via on-device
  // testing — it covered real content on Fitness, Finance, Feed, and More). Scoping it to just
  // the hubs it's actually most useful on — Productivity (daily planning), Mindfulness (mood/
  // reflection prompts), and More (where its own settings live) — keeps the assistant reachable
  // without it permanently sitting on top of Fitness/Finance/Feed content.
  const showAiFab = pathname === '/' || pathname === '/mindfulness-wellness' || pathname === '/more';
  usePublicProfileStatsSync();
  useDefaultCheckinReminders();

  return (
    <View style={{ flex: 1, flexDirection: isDesktopWeb ? 'row' : 'column' }}>
    {isDesktopWeb && <DesktopSidebar />}
    <View style={{ flex: 1 }}>
    <Tabs
      backBehavior="history"
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: isDesktopWeb || hideTabBar ? { display: 'none' } : floatingTabBarStyle(theme),
        tabBarItemStyle: { paddingTop: 6 },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.textPrimary,
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Productivity',
          tabBarIcon: renderTabIcon('today'),
        }}
      />
      <Tabs.Screen
        name="health-fitness"
        options={{
          // Full name shown as the screen's own header (see health-fitness.tsx) — "Health &
          // Fitness" doesn't fit the tab bar's per-item width alongside 4 other tabs and was
          // rendering truncated as "Health & Fitne…" (caught via on-device testing).
          title: 'Fitness',
          headerShown: false,
          tabBarIcon: renderTabIcon('barbell'),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          headerShown: false,
          tabBarIcon: renderTabIcon('cash'),
        }}
      />
      <Tabs.Screen
        name="mindfulness-wellness"
        options={{
          title: 'Mindfulness',
          headerShown: false,
          tabBarIcon: renderTabIcon('leaf'),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Feed',
          headerShown: false,
          tabBarIcon: renderTabIcon('globe'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          // more.tsx renders its own big "More" title — the tab bar's native header showed the
          // exact same word again above it, a literal duplicate (unlike e.g. Productivity/Today,
          // where the native header and the screen's own title are two different words).
          headerShown: false,
          tabBarIcon: renderTabIcon('grid'),
        }}
      />
      {/* Reachable via the "More" hub (Habits/Tasks/Journal under its new "Productivity" section)
          or via the two new grouping tabs above (Health & Fitness, Mindfulness), not shown as
          their own tab bar buttons — href: null keeps the route (and its Stack) registered
          without a tab icon. */}
      <Tabs.Screen name="habits" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="tasks" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="journal" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="analytics" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="calendar" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="meditation" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="breathing" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="affirmations" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="food" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="mind-training" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="workout" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="water" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="cardio" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="timer" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="shopping" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="settings" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="cycle" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="scoreboard" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="mindfulness-checkin" options={{ headerShown: false, href: null }} />
    </Tabs>
    {showAiFab ? <AiAssistantFab /> : null}
    <AppTourModal />
    </View>
    </View>
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
