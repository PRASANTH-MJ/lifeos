import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          ...theme.shadow.sm,
        },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.textPrimary,
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="today" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} />,
        }}
      />
      {/* Reachable via the "More" hub, not shown as their own tab bar buttons — */}
      {/* href: null keeps the route (and its Stack) registered without a tab icon. */}
      <Tabs.Screen name="calendar" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="meditation" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="breathing" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="affirmations" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="finance" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="food" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="mind-training" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="workout" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="analytics" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="timer" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="shopping" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="settings" options={{ headerShown: false, href: null }} />
    </Tabs>
  );
}
