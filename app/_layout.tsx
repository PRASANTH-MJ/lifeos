import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, useColorScheme, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db';
import { configureNotificationHandler, ensureAlarmChannel, getNotificationPermissionSnapshot, openAlarmSettings, requestNotificationPermissions } from '@/notifications';
import { LoginScreen, useAuth } from '@/modules/auth';
import { OnboardingGate, useUserDetails } from '@/modules/onboarding';
import { PinLockScreen, useAvatarSync, useProfile } from '@/modules/profile';
import { usePremium } from '@/modules/premium';
import { ThemeProvider, useAppTheme } from '@/theme';

const ALARM_PROMPT_SHOWN_KEY = 'flowsy-alarm-prompt-shown';

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

/** Android's "Alarms & reminders" special access has no OS request dialog — the only way to
 * grant it is a deep link to Settings, so a hard redirect on cold launch (before the user has
 * even seen the app) would be jarring. Instead, offer once via a plain confirm dialog; "Not now"
 * or "Open Settings" both mark it shown so this never nags on every launch — Settings' own
 * permission row is still there if the user wants to revisit it later. */
function useOfferAlarmPermissionOnLaunch() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const timer = setTimeout(async () => {
      const alreadyShown = await AsyncStorage.getItem(ALARM_PROMPT_SHOWN_KEY);
      if (alreadyShown) return;

      const snapshot = await getNotificationPermissionSnapshot();
      if (snapshot.alarms !== 'denied') return;

      Alert.alert(
        'One more permission',
        'For alarms to ring reliably, Flowsy needs the "Alarms & reminders" permission. You can enable it now or later from Settings.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => AsyncStorage.setItem(ALARM_PROMPT_SHOWN_KEY, '1') },
          {
            text: 'Open Settings',
            onPress: () => {
              AsyncStorage.setItem(ALARM_PROMPT_SHOWN_KEY, '1');
              openAlarmSettings();
            },
          },
        ]
      );
    }, 1500);

    return () => clearTimeout(timer);
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
  const theme = useAppTheme();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, verifyPin, setName } = useProfile();
  const { details: userDetails, loading: detailsLoading, save: saveUserDetails, skipOnboarding } = useUserDetails();
  const [unlocked, setUnlocked] = useState(false);
  usePremium();
  useAvatarSync();
  useAlarmNotificationRouting();
  useRequestNotificationPermissionOnLaunch();
  useOfferAlarmPermissionOnLaunch();

  const loading = authLoading || profileLoading || detailsLoading;

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

  if (userDetails && !userDetails.onboardingDone) {
    return (
      <OnboardingGate
        details={userDetails}
        name={profile?.name ?? ''}
        email={user.email}
        onSave={saveUserDetails}
        onSaveName={setName}
        onSkip={skipOnboarding}
      />
    );
  }

  return (
    <RouterThemeProvider value={theme.scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alarm-ringing" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal', headerShown: true, title: 'Personal Details' }} />
        <Stack.Screen name="feedback" options={{ presentation: 'modal', headerShown: true, title: 'Send Feedback' }} />
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
