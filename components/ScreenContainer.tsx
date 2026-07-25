import type { ReactNode } from 'react';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

type Props = {
  children?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Enables pull-to-refresh (scroll down at the top) — pass the screen's own refresh function. */
  onRefresh?: () => Promise<void> | void;
};

export function ScreenContainer({ children, scroll = true, padded = true, onRefresh }: Props) {
  const theme = useAppTheme();
  const contentStyle = [padded && { padding: theme.spacing.lg }];
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
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      {scroll ? (
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
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
