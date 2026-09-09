import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { FLOATING_TAB_BAR_CLEARANCE, FLOATING_TAB_BAR_CLEARANCE_HIDDEN, isFloatingTabBarHidden } from './tabBarMetrics';
import { useAppTheme } from '@/theme';

type Props = {
  children?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Enables pull-to-refresh (scroll down at the top) — pass the screen's own refresh function. */
  onRefresh?: () => Promise<void> | void;
  /** Defaults to just 'bottom' because most screens using this component sit under a native
   * Stack/Tabs header that already clears the status bar on its own — adding 'top' there too
   * would double the gap. Pass edges={['top', 'bottom']} for a screen with headerShown: false
   * and no header anywhere above it (e.g. a flat tab-bar screen with no nested Stack), or its
   * title text renders flush against the status bar. */
  edges?: Edge[];
  /** Only meaningful with scroll={false}. Set to false when the screen's own internal scrollable
   * (a FlatList, typically) already adds this same floating-tab-bar/AI-FAB clearance itself —
   * see the comment below for why leaving both on double-reserves it. */
  bottomClearance?: boolean;
};

export function ScreenContainer({ children, scroll = true, padded = true, onRefresh, edges = ['bottom'], bottomClearance = true }: Props) {
  const theme = useAppTheme();
  const pathname = usePathname();
  // Routes that hide the floating tab bar (see app/(tabs)/_layout.tsx) only need clearance for
  // the still-visible AI FAB, not the bar's own height too — otherwise scrollable content stops
  // well short of the screen with a large, now-purposeless blank strip at the bottom.
  const clearance = isFloatingTabBarHidden(pathname) ? FLOATING_TAB_BAR_CLEARANCE_HIDDEN : FLOATING_TAB_BAR_CLEARANCE;
  // Screens using scroll={false} manage their own internal scrollable (typically a FlatList) and
  // can opt out of this container ALSO reserving bottom clearance for the floating tab bar/AI FAB
  // via bottomClearance={false} — otherwise that clearance gets double-counted (once here, once
  // more inside the FlatList's own contentContainerStyle where the screen adds it itself),
  // shrinking the visible list for no reason. Defaults to true so every other scroll={false}
  // screen keeps its existing behavior unchanged.
  const skipClearance = !scroll && !bottomClearance;
  const contentStyle = [padded && { padding: theme.spacing.lg, paddingBottom: skipClearance ? theme.spacing.lg : theme.spacing.lg + clearance }];
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = onRefresh
    ? async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={edges}>
      {scroll ? (
        // KeyboardAvoidingView (not the previous useAnimatedKeyboard-driven padding) — that hook
        // is a confirmed no-op on web (react-native-reanimated logs "useAnimatedKeyboard is not
        // available on web yet"), so every ScreenContainer-wrapped form's keyboard-avoidance was
        // silently inert there. KeyboardAvoidingView's listener-based approach actually works
        // cross-platform, matching the fix applied to every other keyboard-avoidance spot in the
        // app (see components/PostCard.tsx, modules/auth/LoginScreen.tsx, etc.).
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              handleRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
              ) : undefined
            }>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
