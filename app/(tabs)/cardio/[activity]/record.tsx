import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { CardioRouteMap } from '@/components/CardioRouteMap';
import {
  CARDIO_ACTIVITY_LABELS,
  bestTimeForFavoriteRoute,
  findNearbyFavoriteRouteStart,
  formatElapsed,
  setPendingSession,
  useCardioLogs,
  useFavoriteRoutes,
  useTrackingSession,
  type CardioActivity,
} from '@/modules/cardio';
import { useAppTheme } from '@/theme';

/** Live GPS recording — native only. CardioRouteMap imports @maplibre/maplibre-react-native,
 * which has no web target at all, so the web build gets a separate record.web.tsx twin instead
 * of a Platform.OS branch inside this file — that keeps the native-only import out of the web
 * bundle entirely rather than just out of the web code path. */
export default function CardioRecordScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { activity: activityParam, comboGroupId: comboGroupIdParam } = useLocalSearchParams<{ activity: CardioActivity; comboGroupId?: string }>();
  const activity = activityParam as CardioActivity;
  const label = CARDIO_ACTIVITY_LABELS[activity];
  const {
    isTracking,
    status,
    elapsedSeconds,
    distanceKm,
    elevationGainM,
    points,
    stationary,
    permissionDenied,
    permissionImprecise,
    start,
    pause,
    resume,
    finish,
  } = useTrackingSession(activity);
  const [saving, setSaving] = useState(false);
  const { favorites } = useFavoriteRoutes();
  const { logs } = useCardioLogs();

  const paceKmh = distanceKm > 0 && elapsedSeconds > 0 ? distanceKm / (elapsedSeconds / 3600) : null;

  // Start-point-only half of the favorite-route heuristic (see modules/cardio/favoriteRoutes.ts)
  // — the session's final distance isn't known yet while still recording, so this can only ever
  // match on where the route began, not "similar total distance" too.
  const nearbyFavorite = useMemo(
    () => (points.length > 0 ? findNearbyFavoriteRouteStart(favorites, activity, points[0]) : null),
    [favorites, activity, points]
  );
  const nearbyFavoriteBestMinutes = nearbyFavorite ? bestTimeForFavoriteRoute(nearbyFavorite, logs) : null;

  const onFinish = async () => {
    setSaving(true);
    const result = await finish();
    // `result` is only ever null when there was no active tracking session to stop at all (see
    // stopTracking's doc comment) — any real finish, however short (a 0.01km test, a session that
    // barely got a GPS fix), always proceeds to save.tsx now. This used to require
    // elapsedSeconds >= 30, which silently discarded short sessions straight back to this screen
    // with no save prompt, no share prompt, and no explanation at all — save.tsx's own "always
    // land on the share step" fix already handles the < 2 route-point case gracefully, so there's
    // no reason to discard the session before it even gets there.
    if (result) {
      // Route data can be thousands of points — too large for a router param, so it's handed off
      // via a small in-memory holder (see modules/cardio/pendingSession.ts) that save.tsx reads
      // right after this navigation. Not persisted yet: the user can still discard it there.
      setPendingSession({
        activity,
        distanceKm: result.distanceKm,
        elapsedSeconds: result.elapsedSeconds,
        points: result.points,
        elevationGainM: result.elevationGainM,
        comboGroupId: comboGroupIdParam ?? null,
      });
      router.replace({ pathname: '/cardio/[activity]/save', params: { activity } });
      return;
    }
    setSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1 }}>
        <CardioRouteMap points={points} showStyleToggle />
      </View>

      {nearbyFavorite && nearbyFavoriteBestMinutes != null ? (
        <View
          style={{
            position: 'absolute',
            top: theme.spacing.xl,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.surface,
            ...theme.shadow.sm,
          }}>
          <Ionicons name="star" size={14} color={theme.colors.warning} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
            You're near a favorite route — your best time here: {formatElapsed(nearbyFavoriteBestMinutes * 60)}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={() => router.back()} style={{ position: 'absolute', top: theme.spacing.xl, left: theme.spacing.lg }} hitSlop={8}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="chevron-down" size={24} color={theme.colors.textSecondary} />
        </View>
      </Pressable>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          padding: theme.spacing.xl,
          gap: theme.spacing.lg,
          alignItems: 'center',
        }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          {label}
          {status === 'paused' ? ' · Paused' : ''}
        </Text>

        {status !== 'paused' && stationary ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 4,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.dangerMuted,
            }}>
            <Ionicons name="pause-circle-outline" size={14} color={theme.colors.danger} />
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
              Auto-paused (stationary)
            </Text>
          </View>
        ) : null}

        <Text style={{ color: theme.colors.textPrimary, fontSize: 52, fontWeight: theme.typography.weight.bold }}>{formatElapsed(elapsedSeconds)}</Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing['2xl'] }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {distanceKm.toFixed(2)}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>KM</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {paceKmh != null ? paceKmh.toFixed(1) : '—'}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>KM/H</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {elevationGainM}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>GAIN (M)</Text>
          </View>
        </View>

        {permissionDenied ? (
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            Location access is needed to record your route. Enable it in your device settings and try again.
          </Text>
        ) : null}
        {permissionImprecise ? (
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            Location is set to "Approximate" — Flowsy needs "Precise" location to track distance accurately. Enable
            it in your device's Settings → Apps → Flowsy → Permissions → Location.
          </Text>
        ) : null}

        {!isTracking ? (
          <Button label="Start" onPress={start} glow />
        ) : (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <Button label={status === 'paused' ? 'Resume' : 'Pause'} variant="secondary" onPress={status === 'paused' ? resume : pause} />
            <Button label={saving ? 'Saving…' : 'Finish'} variant="danger" onPress={onFinish} disabled={saving} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
