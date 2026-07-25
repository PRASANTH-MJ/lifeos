import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db';
import { configureNotificationHandler } from '@/notifications';
import { PinLockScreen, useProfile } from '@/modules/profile';
import { ThemeProvider } from '@/theme';

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
        <ThemeProvider>
          <RootNavigation />
        </ThemeProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

function RootNavigation() {
  const colorScheme = useColorScheme();
  const { profile, loading, verifyPin } = useProfile();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (profile?.pinEnabled && !unlocked) {
    return <PinLockScreen verifyPin={verifyPin} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <RouterThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </RouterThemeProvider>
  );
}

function LoadingScreen() {
  const theme = useAppThemeSafe();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme }}>
      <ActivityIndicator />
    </View>
  );
}

function useAppThemeSafe(): string {
  // The real ThemeProvider isn't mounted yet while SQLite is suspended, so the
  // fallback uses the OS scheme directly instead of useAppTheme().
  const scheme = useColorScheme();
  return scheme === 'dark' ? '#0B0D12' : '#F9FAFB';
}
