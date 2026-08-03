import notifee, { EventType } from '@notifee/react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db';
import { configureNotificationHandler, ensureAlarmChannel, requestNotificationPermissions } from '@/notifications';
import { LoginScreen, useAuth } from '@/modules/auth';
import { PinLockScreen, useProfile } from '@/modules/profile';
import { usePremium } from '@/modules/premium';
import { ThemeProvider } from '@/theme';

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();
ensureAlarmChannel();

// Required by notifee even when there's nothing to do here — background events (e.g. a full-screen
// alarm launching while the app is killed) are instead picked up via getInitialNotification() once
// the JS layer is running again, in useAlarmNotificationRouting below.
if (Platform.OS !== 'web') {
  notifee.onBackgroundEvent(async () => {});
}

type AlarmNotificationData = { kind?: string; identifier?: string; title?: string; body?: string };

/** Routes to the full-screen ringing UI whenever an alarm-type reminder fires — whether the app
 * was cold-started by the notification's full-screen intent, or the alarm arrived while the app
 * was already open. */
function useAlarmNotificationRouting() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const routeToAlarm = (data?: AlarmNotificationData) => {
      if (!data || data.kind !== 'alarm') return;
      router.push({
        pathname: '/alarm-ringing',
        params: { identifier: data.identifier ?? '', title: data.title ?? 'Alarm', body: data.body ?? '' },
      });
    };

    notifee
      .getInitialNotification()
      .then((initial) => routeToAlarm(initial?.notification.data as AlarmNotificationData | undefined))
      .catch(() => {});

    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.DELIVERED) {
        routeToAlarm(detail.notification?.data as AlarmNotificationData | undefined);
      }
    });
  }, [router]);
}

/** Asks for notification access up front, on first mount, rather than waiting for the user to
 * stumble into a module's reminder toggle — Android only shows its permission dialog once, so
 * asking early gives the best chance of a grant instead of a silent permanent denial. */
function useRequestNotificationPermissionOnLaunch() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    requestNotificationPermissions();
  }, []);
}

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
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, verifyPin } = useProfile();
  const [unlocked, setUnlocked] = useState(false);
  usePremium();
  useAlarmNotificationRouting();
  useRequestNotificationPermissionOnLaunch();

  const loading = authLoading || profileLoading;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (profile?.pinEnabled && !unlocked) {
    return <PinLockScreen verifyPin={verifyPin} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <RouterThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alarm-ringing" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
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
