import * as Crypto from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';

import { ActivityShareCarousel, Button, Card, Chip, PrBanner, ScreenContainer, TextField, showAlert, type ShareCardData } from '@/components';
import { CardioRouteMap } from '@/components/CardioRouteMap';
import { REVEAL_DURATION_MS, RouteRevealMap, type RouteRevealMapHandle } from '@/components/RouteRevealMap';
import { FLOATING_TAB_BAR_CLEARANCE_HIDDEN } from '@/components/tabBarMetrics';
import { todayKey } from '@/lib/date';
import {
  CARDIO_ACTIVITY_LABELS,
  CARDIO_MOODS,
  CARDIO_MOOD_LABELS,
  CARDIO_WEATHERS,
  CARDIO_WEATHER_LABELS,
  bestTimeForFavoriteRoute,
  checkCardioPr,
  clearPendingSession,
  computeCardioStreak,
  findMatchingFavoriteRoute,
  formatElapsed,
  formatPace,
  formatSpeedKmh,
  getPendingSession,
  useCardioLogs,
  useFavoriteRoutes,
  type CardioActivity,
  type CardioMood,
  type CardioWeather,
} from '@/modules/cardio';
import { framesToGif } from '@/modules/social/gifExport';
import { useAppTheme } from '@/theme';

// Number of evenly-spaced snapshots taken across RouteRevealMap's reveal animation for the
// animated-GIF share option. The live reveal itself steps through REVEAL_STEPS (40) increments
// over REVEAL_DURATION_MS — sampling only 12 of those (the original value here) produced a
// visibly choppier GIF than what the reveal actually looks like live, which is exactly what
// on-device testing flagged: "that [live reveal] was smooth, [the posted GIF wasn't]". 28 gets
// close to the live reveal's smoothness without tripling encode time/file size the way matching
// all 40 steps would (each frame is a full screenshot + PNG-decode + quantize/palette-apply
// pass, so more frames costs real on-device time — see gifExport.ts's on-device-verification
// caveat).
const GIF_FRAME_COUNT = 28;

/** One stat in the post-run reveal — springs in with a staggered delay so Distance, Time, and
 * Pace land one after another rather than all appearing at once, giving the results a bit of a
 * "countdown" feel instead of a flat static readout. */
function StatReveal({ value, label, delayMs }: { value: string; label: string; delayMs: number }) {
  const theme = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delayMs),
      Animated.spring(progress, { toValue: 1, damping: 14, stiffness: 140, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = {
    opacity: progress,
    transform: [
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
    ],
  };

  return (
    <Animated.View style={[{ flex: 1, alignItems: 'center' }, style]}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>{value}</Text>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{label}</Text>
    </Animated.View>
  );
}

function defaultTitle(activity: CardioActivity): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const label = CARDIO_ACTIVITY_LABELS[activity];
  return `${timeOfDay} ${label}`;
}

/**
 * Shown right after "Finish" on record.tsx. record.tsx only hands off the session's raw
 * numbers/route (see modules/cardio/pendingSession.ts); nothing is written to cardio_logs until
 * "Save Activity" here is tapped, so "Discard" needs no cleanup. Native only, same as record.tsx —
 * there's no route to land here on web since record.web.tsx never produces a session.
 *
 * A single scrollable page, not a two-step edit-then-share flow: title/mood/weather/Save sits
 * above an always-visible "share this activity" section (route map/GIF, streak, or a photo with
 * one of 3 templates) with its own independent Post to Feed. Saving the activity and posting to
 * Feed are two separate actions that both happen to live on this one page now — posting doesn't
 * require having tapped Save Activity first (it writes to a different Firestore collection
 * entirely), but if you post without having saved yet, `ensureSaved` below saves it for you first
 * so the activity itself is never lost.
 */
export default function CardioSaveScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { activity: activityParam } = useLocalSearchParams<{ activity: CardioActivity }>();
  const activity = activityParam as CardioActivity;
  const { logs, addLog } = useCardioLogs();
  const { favorites, addFavorite } = useFavoriteRoutes();
  const session = getPendingSession();

  const [title, setTitle] = useState(defaultTitle(activity));
  const [mood, setMood] = useState<CardioMood | null>(null);
  const [weather, setWeather] = useState<CardioWeather | null>(null);
  const [saving, setSaving] = useState(false);
  const [activitySaved, setActivitySaved] = useState(false);
  const [prResult, setPrResult] = useState<{ isDistancePr: boolean; isPacePr: boolean } | null>(null);
  const [savedAsFavorite, setSavedAsFavorite] = useState(false);
  const revealMapRef = useRef<RouteRevealMapHandle>(null);
  const [routeSnapshotUri, setRouteSnapshotUri] = useState<string | null>(null);
  const [gifUri, setGifUri] = useState<string | null>(null);
  const [gifPreparing, setGifPreparing] = useState(false);

  // Fires once RouteRevealMap has collected all GIF_FRAME_COUNT frames from the reveal — encodes
  // them in the background so the GIF is (usually) ready by the time the user reaches "Post to
  // Feed" in the share section below; see ActivityShareCarousel's animatedGifUri/gifPreparing
  // props for what happens if it isn't ready yet.
  const onFramesCaptured = (frameUris: string[]) => {
    if (frameUris.length === 0) return;
    setGifPreparing(true);
    framesToGif(frameUris, { frameDelayMs: REVEAL_DURATION_MS / frameUris.length })
      .then(setGifUri)
      .catch(() => {
        // Encoding failed (bad frame data, out-of-memory on a long route, etc.) — the toggle in
        // ActivityShareCarousel just never becomes enabled, silently falling back to
        // static-image-only.
      })
      .finally(() => setGifPreparing(false));
  };

  // Full start-point + distance heuristic (see modules/cardio/favoriteRoutes.ts) — the session's
  // final distance is known by now, unlike record.tsx's start-point-only banner.
  const matchedFavorite =
    session && session.points.length > 0 ? findMatchingFavoriteRoute(favorites, activity, session.points[0], session.distanceKm) : null;
  const bestOnRouteMinutes = matchedFavorite ? bestTimeForFavoriteRoute(matchedFavorite, logs) : null;

  const onSaveAsFavoriteRoute = async () => {
    if (!session || session.points.length === 0) return;
    await addFavorite({ activity, label: title.trim() || defaultTitle(activity), startLat: session.points[0].lat, startLng: session.points[0].lng, distanceKm: session.distanceKm });
    setSavedAsFavorite(true);
  };

  // `addAnotherLeg` hands off to /cardio/log to pick the next activity instead of staying here —
  // see modules/cardio/pendingSession.ts's comboGroupId doc for how that next leg ends up stamped
  // with the same id as this one. Returns whether the activity ended up saved (already-saved
  // counts as success) so both the Save Activity button and the share section's onDone can tell.
  const onSave = async (addAnotherLeg: boolean): Promise<boolean> => {
    if (!session) {
      router.dismissTo('/cardio');
      return false;
    }
    if (activitySaved && !addAnotherLeg) return true;
    setSaving(true);
    const distanceKm = Math.round(session.distanceKm * 100) / 100;
    const durationMinutes = Math.max(1, Math.round(session.elapsedSeconds / 60));
    // Compared against the logs already loaded (pre-insert), so this session isn't checked
    // against itself once addLog below writes it.
    const pr = checkCardioPr(activity, logs.filter((log) => log.activity === activity), { distanceKm, durationMinutes });
    const comboGroupId = addAnotherLeg ? (session.comboGroupId ?? Crypto.randomUUID()) : session.comboGroupId;
    let saved: boolean;
    try {
      // addLog can resolve `false` without throwing — it shows a "possible duplicate" confirm
      // (see modules/cardio/useCardioLogs.ts's DUPLICATE_WINDOW_MS) whenever a same-activity,
      // same-day, similar-distance log already exists from the last 10 seconds, which repeated
      // quick test saves (or legitimately saving several short combo legs back-to-back) trigger
      // constantly. This is checked below rather than assumed true — a declined duplicate must
      // not be treated as a successful save.
      saved = await addLog({
        activity,
        date: todayKey(),
        distanceKm,
        durationMinutes,
        note: title.trim() || null,
        routePoints: session.points,
        mood,
        weather,
        photoUri: null,
        elevationGainM: session.elevationGainM,
        comboGroupId,
      });
    } catch {
      setSaving(false);
      showAlert('Couldn’t save', 'Something went wrong saving this activity — please try again.');
      return false;
    }
    setSaving(false);
    if (!saved) return false;
    if (pr.isDistancePr || pr.isPacePr) setPrResult(pr);
    // pendingSession is cleared now so a stray back navigation can't re-save it — the route
    // points it held are still available via `session` (a plain object reference, not re-read
    // from storage) for the reveal animation and share section below.
    clearPendingSession();
    if (addAnotherLeg) {
      router.replace({ pathname: '/cardio/log', params: { comboGroupId: comboGroupId ?? undefined } });
      return true;
    }
    setActivitySaved(true);
    return true;
  };

  // The share section's "Skip"/"Post to Feed" both call this — ensures the activity itself is
  // saved (a no-op if the Save Activity button already handled it) before leaving, so posting
  // first never loses the activity that was being logged.
  const onShareDone = async () => {
    await onSave(false);
    router.dismissTo('/cardio');
  };

  // Computed live (not a stale hook re-read) so the share section's streak always reflects this
  // session, whether or not it's been saved to cardio_logs yet.
  const streakIncludingThisSession = computeCardioStreak([...logs, { date: todayKey() }]);

  const shareCard: ShareCardData = {
    eyebrow: `${CARDIO_ACTIVITY_LABELS[activity].toUpperCase()}${title.trim() ? ` · ${title.trim()}` : ''}`,
    value: session ? session.distanceKm.toFixed(2) : '0',
    valueLabel: 'KM',
    detail: session ? formatElapsed(session.elapsedSeconds) : '',
    icon: 'walk',
    accentColor: '#FF6B35',
  };

  // Distance/Pace/Time/elevation gain — the stats-card carousel's full breakdown (see
  // ActivityShareCarousel), and also what PhotoStoryTemplate overlays on the route photo itself,
  // matching Strava's own story-share format.
  const shareStats = session
    ? [
        { label: 'Distance', value: `${session.distanceKm.toFixed(2)} km` },
        { label: 'Pace', value: formatPace(session.distanceKm, session.elapsedSeconds) },
        { label: 'Time', value: formatElapsed(session.elapsedSeconds) },
        ...(session.elevationGainM > 0 ? [{ label: 'Elevation gain', value: `${session.elevationGainM} m` }] : []),
      ]
    : undefined;

  const onDiscard = () => {
    showAlert('Discard this activity?', 'The recorded route and time will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clearPendingSession();
          router.dismissTo('/cardio');
        },
      },
    ]);
  };

  if (!session) {
    // Reached directly (e.g. a stale link, or a cold-started deep link) with no in-memory
    // session to save — nothing usable to show, so just bounce back to the hub.
    router.dismissTo('/cardio');
    return null;
  }

  return (
    <ScreenContainer scroll={false} bottomClearance={false}>
      {/* gestureEnabled: false too, not just headerBackVisible — the swipe-back gesture stays
          live even with the header button hidden, and an unsaved session was silently discarded
          by a stray swipe/back tap exactly like it would be by "Discard" below. Once saved, both
          are re-enabled (see the header options update below) since there's nothing left to lose. */}
      <Stack.Screen options={{ title: 'Save Activity', headerBackVisible: activitySaved, gestureEnabled: activitySaved }} />
      <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl + FLOATING_TAB_BAR_CLEARANCE_HIDDEN }}>
        <View style={{ height: 200, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
          <CardioRouteMap points={session.points} followUser={false} showStyleToggle />
        </View>

        <Card tier="panel" style={{ flexDirection: 'row' }}>
          <StatReveal value={session.distanceKm.toFixed(2)} label="KM" delayMs={0} />
          <StatReveal value={formatElapsed(session.elapsedSeconds)} label="TIME" delayMs={150} />
          <StatReveal value={formatSpeedKmh(session.distanceKm, session.elapsedSeconds)} label="KM/H" delayMs={300} />
          <StatReveal value={String(session.elevationGainM)} label="GAIN (M)" delayMs={450} />
        </Card>

        {prResult ? (
          <PrBanner
            label={
              [prResult.isDistancePr ? 'Longest distance' : null, prResult.isPacePr ? 'Fastest pace' : null].filter(Boolean).join(' · ') ||
              CARDIO_ACTIVITY_LABELS[activity]
            }
          />
        ) : null}

        <TextField label="Title" value={title} onChangeText={setTitle} placeholder={defaultTitle(activity)} editable={!activitySaved} />

        {matchedFavorite && bestOnRouteMinutes != null ? (
          <Card tier="panel" style={{ gap: 2 }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              vs your best on {matchedFavorite.label}
            </Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Your best: {formatElapsed(bestOnRouteMinutes * 60)} · This session: {formatElapsed(session.elapsedSeconds)}
            </Text>
          </Card>
        ) : session.points.length > 1 && !savedAsFavorite ? (
          <Button label="Save this as a favorite route" variant="secondary" onPress={onSaveAsFavoriteRoute} />
        ) : savedAsFavorite ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Saved as a favorite route.</Text>
        ) : null}

        <Card tier="panel" style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            How did it feel?
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            {CARDIO_MOODS.map((option) => (
              <Chip
                key={option}
                label={CARDIO_MOOD_LABELS[option]}
                selected={mood === option}
                onPress={() => !activitySaved && setMood(mood === option ? null : option)}
              />
            ))}
          </View>
        </Card>

        <Card tier="panel" style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Weather
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            {CARDIO_WEATHERS.map((option) => (
              <Chip
                key={option}
                label={CARDIO_WEATHER_LABELS[option]}
                selected={weather === option}
                onPress={() => !activitySaved && setWeather(weather === option ? null : option)}
              />
            ))}
          </View>
        </Card>

        {activitySaved ? (
          <Card tier="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
              ✓ Activity saved
            </Text>
          </Card>
        ) : (
          <>
            <Button label="Save Activity" onPress={() => onSave(false)} loading={saving} glow />
            <Button label="Save & add another leg to this session" variant="secondary" onPress={() => onSave(true)} disabled={saving} />
            <Button label="Discard" variant="ghost" onPress={onDiscard} disabled={saving} />
          </>
        )}

        {/* Route-reveal capture (for the share section's route photo/GIF option below) mounts
            unconditionally alongside everything else on this one page now, rather than behind a
            separate "share" screen reached only after saving — see the module doc comment above. */}
        {session.points.length > 1 ? (
          <View style={{ height: 260, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
            <RouteRevealMap
              ref={revealMapRef}
              points={session.points}
              onRevealComplete={() => {
                // Snapshot once the line has fully drawn in — capturing mid-animation would
                // freeze the post's image on a half-drawn route.
                revealMapRef.current?.capture().then(setRouteSnapshotUri);
              }}
              captureFrameCount={GIF_FRAME_COUNT}
              onFramesCaptured={onFramesCaptured}
            />
          </View>
        ) : null}
        <ActivityShareCarousel
          type="activity"
          card={shareCard}
          routePhotoUri={session.points.length > 1 ? routeSnapshotUri : null}
          animatedGifUri={session.points.length > 1 ? gifUri : undefined}
          gifPreparing={gifPreparing}
          routePoints={session.points}
          stats={shareStats ?? []}
          initialPhotoUri={null}
          streak={streakIncludingThisSession}
          onDone={onShareDone}
        />
      </ScrollView>
    </ScreenContainer>
  );
}
