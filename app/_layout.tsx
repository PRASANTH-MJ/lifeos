import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db';
import { AuthProvider, useAuth } from '@/modules/auth';
import { configureNotificationHandler } from '@/notifications';
import { ThemeProvider } from '@/theme';

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigation />
          </AuthProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

function RootNavigation() {
  const colorScheme = useColorScheme();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <RouterThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
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
