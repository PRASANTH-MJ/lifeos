import { Buffer } from 'buffer';

// pngjs (used by modules/social/gifExport.ts to decode captured PNG frames for the route-share
// GIF export feature) expects a global `Buffer`, same as plain Node code — RN/Hermes has no such
// global by default. Set as early as possible (root layout, before anything else runs) via the
// `buffer` package (a pure-JS polyfill wired up as the `buffer` Metro alias too — see
// metro.config.js) rather than inside gifExport.ts itself, so it's available regardless of which
// module happens to import Buffer-touching code first.
// @ts-expect-error - global.Buffer isn't declared on RN's global scope by default
global.Buffer = global.Buffer || Buffer;

import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider, useRouter, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';

import { OfflineBanner } from '@/components/OfflineBanner';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import { showAlert } from '@/components/showAlert';
import { StorageProvider } from '@/db';
import {
  configureNotificationHandler,
  ensureAlarmChannel,
  getNotificationPermissionSnapshot,
  openAlarmSettings,
  requestNotificationPermissions,
  scheduleWeeklyReminder,
  WEEKLY_REVIEW_REMINDER_ID,
} from '@/notifications';
import { LoginScreen, useAuth } from '@/modules/auth';
import { LandingScreen } from '@/modules/marketing';
import { registerPushToken, usePushToken } from '@/modules/notifications';
import { OnboardingGate, useUserDetails } from '@/modules/onboarding';
import { PinLockScreen, useAvatarSync, useProfile } from '@/modules/profile';
import { PublicPostPreview } from '@/modules/social';
import { useBillingSync, usePremium } from '@/modules/premium';
import { useSyncConflictNotice, useSyncEngine } from '@/modules/sync';
import { ThemeProvider, useAppTheme } from '@/theme';

import PrivacyPolicyScreen from './privacy-policy';
import RefundPolicyScreen from './refund-policy';
import TermsScreen from './terms';

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
 * was already open.
 *
 * `ready` must reflect whether RootNavigation's real `<Stack>` (the one with an "alarm-ringing"
 * screen registered) is actually mounted — not just whether auth has resolved. RootNavigation
 * renders a bare `<LoadingScreen />` (no Stack at all) while auth/profile/details are loading,
 * and PinLockScreen/OnboardingGate before that too; a notification tap that cold-starts the app
 * fires this hook's effect immediately, well before any of those gates clear, so calling
 * router.push() unconditionally dispatched into a navigator that didn't exist yet — the
 * "notification opens the app to a white screen" bug. Any alarm data that arrives before `ready`
 * flips true is held and flushed the moment the real Stack mounts, instead of being dropped or
 * pushed into nothing. */
function useAlarmNotificationRouting(ready: boolean) {
  const router = useRouter();
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const pendingRef = useRef<AlarmNotificationData | null>(null);

  const routeToAlarm = useCallback(
    (data?: AlarmNotificationData) => {
      if (!data || data.kind !== 'alarm') return;
      if (!readyRef.current) {
        pendingRef.current = data;
        return;
      }
      router.push({
        pathname: '/alarm-ringing',
        params: { identifier: data.identifier ?? '', title: data.title ?? 'Alarm', body: data.body ?? '' },
      });
    },
    [router]
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;

    notifee
      .getInitialNotification()
      .then((initial) => routeToAlarm(initial?.notification.data as AlarmNotificationData | undefined))
      .catch(() => {});

    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.DELIVERED) {
        routeToAlarm(detail.notification?.data as AlarmNotificationData | undefined);
      }
    });
  }, [routeToAlarm]);

  useEffect(() => {
    if (!ready || !pendingRef.current) return;
    const data = pendingRef.current;
    pendingRef.current = null;
    routeToAlarm(data);
  }, [ready, routeToAlarm]);
}

/** Routes to whatever screen a remote push notification's payload names (see functions/index.js's
 * notify(), which sets `data.route` per notification type) whenever the user taps it — whether
 * the app was already open or the tap cold-started it. Separate from
 * useAlarmNotificationRouting above: that one handles notifee's *local* full-screen alarms, this
 * one handles expo-notifications' *remote* pushes, and the two never overlap.
 *
 * Same `ready`-gated hold-and-flush as useAlarmNotificationRouting above, and for the identical
 * reason: a cold-start tap fires this effect before RootNavigation's real `<Stack>` mounts, so an
 * unconditional router.push() here was the same "white screen" bug for remote pushes (chat
 * messages, comments, likes, etc.) as it was for local alarms. */
function useNotificationResponseRouting(ready: boolean) {
  const router = useRouter();
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const pendingRouteRef = useRef<string | null>(null);

  const routeFromResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      const route = response?.notification.request.content.data?.route;
      if (typeof route !== 'string' || !route) return;
      if (!readyRef.current) {
        pendingRouteRef.current = route;
        return;
      }
      router.push(route as never);
    },
    [router]
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;

    Notifications.getLastNotificationResponseAsync().then(routeFromResponse).catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener(routeFromResponse);
    return () => subscription.remove();
  }, [routeFromResponse]);

  useEffect(() => {
    if (!ready || !pendingRouteRef.current) return;
    const route = pendingRouteRef.current;
    pendingRouteRef.current = null;
    router.push(route as never);
  }, [ready, router]);
}

/** Asks for notification access up front, on first mount, rather than waiting for the user to
 * stumble into a module's reminder toggle — Android only shows its permission dialog once, so
 * asking early gives the best chance of a grant instead of a silent permanent denial.
 *
 * Registers the push token right after a fresh grant (same as Settings' "enable notifications"
 * fix flow) rather than relying on usePushToken alone: usePushToken's own mount effect runs
 * earlier in RootNavigation's hook order, so on a first-ever grant it has already checked
 * getPermissionsAsync(), found nothing, and no-opped before this request even resolves — nothing
 * else re-triggers registration until the next full app launch, since addPushTokenListener only
 * fires on a native token rotation, not on a permission grant. */
function useRequestNotificationPermissionOnLaunch(uid: string | null | undefined) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    requestNotificationPermissions().then((granted) => {
      if (granted && uid) registerPushToken(uid).catch(() => {});
    });
  }, [uid]);
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

      showAlert(
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

/** Sunday-evening nudge into the Weekly Review screen (overdue tasks, this week's due tasks,
 * upcoming events — see app/weekly-review.tsx) — scheduled unconditionally on every launch, same
 * "cancel-then-recreate under one fixed identifier" idempotent shape as the Scoreboard's weekly
 * reminder (see notifications/schedule.ts), just with no settings toggle gating it. */
function useScheduleWeeklyReviewReminder() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    scheduleWeeklyReminder({
      identifier: WEEKLY_REVIEW_REMINDER_ID,
      title: 'Weekly Review',
      body: 'See what’s overdue, what’s due this week, and what’s coming up.',
      weekday: 1,
      hour: 18,
      minute: 0,
      data: { route: '/weekly-review' },
    }).catch(() => {});
  }, []);
}

export default function RootLayout() {
  // Only Cyber Sanctuary uses Inter (see theme/tokens.ts's THEME_FONT_FAMILY) — every other
  // theme keeps the platform's System font — but which theme is active isn't known until
  // ThemeProvider mounts below, so these weights load unconditionally, once, up front here.
  // Held behind the splash screen (already prevented from auto-hiding) exactly like the
  // auth/profile/details loading gate in RootNavigation below, so nothing ever renders with a
  // flash of the wrong font.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <RootErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <StorageProvider>
          <ThemeProvider>
            <OfflineBanner />
            <RootNavigation />
          </ThemeProvider>
        </StorageProvider>
      </Suspense>
    </RootErrorBoundary>
  );
}

function RootNavigation() {
  const theme = useAppTheme();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, verifyPin, setName, setGender, setAvatarUri } = useProfile();
  const { details: userDetails, loading: detailsLoading, save: saveUserDetails, skipOnboarding } = useUserDetails();
  const [unlocked, setUnlocked] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  usePremium();
  useAvatarSync();
  useBillingSync();
  useSyncEngine();
  useSyncConflictNotice();
  usePushToken(user?.uid);

  const loading = authLoading || profileLoading || detailsLoading;
  // True only once the real `<Stack>` below (with "alarm-ringing" and every other route
  // registered) is what's actually mounted — not just once auth has resolved. PinLockScreen and
  // OnboardingGate both render in place of that Stack too, and a notification tap can cold-start
  // the app straight into any of these gates, so routing hooks below must wait for all of them to
  // clear (see each hook's own doc comment for the "white screen" bug this fixes).
  const stackReady =
    !loading && !!user && !(profile?.pinEnabled && !unlocked) && !(userDetails && !userDetails.onboardingDone);

  useAlarmNotificationRouting(stackReady);
  useRequestNotificationPermissionOnLaunch(user?.uid);
  useOfferAlarmPermissionOnLaunch();
  useNotificationResponseRouting(stackReady);
  useScheduleWeeklyReviewReminder();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    // On the web, an unauthenticated visitor (e.g. a payment-provider reviewer, or someone who
    // just typed the domain) should land on a public marketing page describing the product,
    // pricing, and policies — not straight into a bare sign-in form. Native app users skip this;
    // they already chose to install the app and expect to go straight to sign-in.
    if (Platform.OS === 'web') {
      if (pathname === '/terms') return <TermsScreen />;
      if (pathname === '/refund-policy') return <RefundPolicyScreen />;
      if (pathname === '/privacy-policy') return <PrivacyPolicyScreen />;
      // A shared post link (see modules/social/postShareUrl.ts) needs to render for a visitor
      // with no account at all, same reasoning as the three static pages above — this is the
      // only one of the four that's dynamic, hence the regex instead of an exact match.
      const postMatch = pathname.match(/^\/post\/([^/]+)/);
      if (postMatch) return <PublicPostPreview postId={postMatch[1]} />;
      if (!showAuthForm) return <LandingScreen onSignIn={() => setShowAuthForm(true)} />;
    }
    return <LoginScreen />;
  }

  if (profile?.pinEnabled && !unlocked) {
    return <PinLockScreen verifyPin={verifyPin} onUnlock={() => setUnlocked(true)} biometricEnabled={profile.biometricEnabled} />;
  }

  if (userDetails && !userDetails.onboardingDone) {
    return (
      <OnboardingGate
        details={userDetails}
        name={profile?.name ?? ''}
        email={user.email}
        gender={profile?.gender ?? null}
        avatarUri={profile?.avatarUri ?? null}
        onSave={saveUserDetails}
        onSaveName={setName}
        onGenderChange={setGender}
        onAvatarChange={setAvatarUri}
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
        <Stack.Screen name="assistant" options={{ presentation: 'modal', headerShown: true, title: 'For You' }} />
        <Stack.Screen name="help" options={{ presentation: 'modal', headerShown: true, title: 'Help & Support' }} />
        <Stack.Screen name="changelog" options={{ presentation: 'modal', headerShown: true, title: "What's New" }} />
        <Stack.Screen name="weekly-review" options={{ presentation: 'modal', headerShown: true, title: 'Weekly Review' }} />
        <Stack.Screen name="delete-account" options={{ presentation: 'modal', headerShown: true, title: 'Delete Account' }} />
        <Stack.Screen name="admin-analytics" options={{ presentation: 'modal', headerShown: true, title: 'Analytics' }} />
        <Stack.Screen name="relationships" options={{ presentation: 'modal', headerShown: true, title: 'Relationships' }} />
        <Stack.Screen name="cycle-new" options={{ presentation: 'modal', headerShown: true, title: 'Log Today' }} />
        <Stack.Screen name="post/[postId]" options={{ headerShown: true, title: 'Post' }} />
        <Stack.Screen name="privacy-policy" options={{ presentation: 'modal', headerShown: true, title: 'Privacy Policy' }} />
        <Stack.Screen name="terms" options={{ presentation: 'modal', headerShown: true, title: 'Terms & Conditions' }} />
        <Stack.Screen name="refund-policy" options={{ presentation: 'modal', headerShown: true, title: 'Refund & Cancellation Policy' }} />
        {/* These five "add/edit" screens are opened both from within their own tab AND from the
            Today tab's "+" menu (a different tab). Nested inside a tab's own stack, that cross-tab
            push left the tab navigator's active-tab/stack state inconsistent — after saving (or
            just pressing back) you could land on the wrong tab, or find the screen still "stuck"
            open when you next switched to its actual tab. Root-level modals don't belong to any
            tab's stack, so there's no such inconsistency regardless of which tab opened them. */}
        <Stack.Screen name="habits-new" options={{ presentation: 'modal', headerShown: true, title: 'New Habit' }} />
        <Stack.Screen name="journal-new" options={{ presentation: 'modal', headerShown: true, title: 'New Entry' }} />
        <Stack.Screen name="tasks-new" options={{ presentation: 'modal', headerShown: true, title: 'New Task' }} />
        <Stack.Screen name="finance-new" options={{ presentation: 'modal', headerShown: true, title: 'New Transaction' }} />
        <Stack.Screen name="food-new" options={{ presentation: 'modal', headerShown: true, title: 'Log Food' }} />
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
