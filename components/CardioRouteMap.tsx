import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Map, GeoJSONSource, Layer, UserLocation, type StyleSpecification } from '@maplibre/maplibre-react-native';

import type { RoutePoint } from '@/modules/cardio';
import { useAppTheme } from '@/theme';

type Props = {
  points: RoutePoint[];
  routeColor?: string;
  followUser?: boolean;
  /** Shows the small Standard/Satellite/Hybrid map-style toggle in the top-right corner. Off by default
   * — a tiny history-row thumbnail (see app/(tabs)/cardio/[activity]/index.tsx) has no room for
   * chrome like this and doesn't need it; the live recording screen and the post-run save screen
   * both opt in. */
  showStyleToggle?: boolean;
};

/** OpenFreeMap's "liberty" style — a free, keyless vector basemap (no billed API key needed,
 * unlike Google Maps). Same free/no-billing tile stack the app is standardizing on for both
 * native and web maps. */
const MAP_STYLE_STANDARD = 'https://tiles.openfreemap.org/styles/liberty';

/** Esri's free, keyless "World Imagery" raster tile service — no API key or billing, the same
 * satellite source widely used by open-source mapping projects. Declared as a full (if minimal)
 * MapLibre style — one raster source plus one raster layer — rather than layering MapLibre RN's
 * <RasterSource>/<RasterLayer> child components onto an existing vector style, since here the
 * satellite imagery *is* the whole basemap, not an overlay on top of one. */
const MAP_STYLE_SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    esriWorldImagery: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [{ id: 'esriWorldImagery', type: 'raster', source: 'esriWorldImagery' }],
};

/** Esri's free, keyless "World Boundaries and Places" reference overlay — a transparent-background
 * raster of place names/labels/boundaries meant to be stacked on top of a satellite base, same free
 * ArcGIS Online service family as World_Imagery above (no API key or billing). Combined with
 * MAP_STYLE_SATELLITE's imagery layer below, this is what makes "Hybrid" != plain "Satellite". */
const ESRI_LABELS_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

/** "Hybrid" — the same Esri World Imagery raster base as MAP_STYLE_SATELLITE, with the Esri labels
 * overlay stacked as a second raster source/layer on top so place names and boundaries render over
 * the imagery. Layer order matters here: 'esriLabels' is listed after 'esriWorldImagery' so it
 * paints on top. */
const MAP_STYLE_HYBRID: StyleSpecification = {
  version: 8,
  sources: {
    esriWorldImagery: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
    esriLabels: {
      type: 'raster',
      tiles: [ESRI_LABELS_TILE_URL],
      tileSize: 256,
      attribution: 'Esri',
    },
  },
  layers: [
    { id: 'esriWorldImagery', type: 'raster', source: 'esriWorldImagery' },
    { id: 'esriLabels', type: 'raster', source: 'esriLabels' },
  ],
};

type MapStyleKey = 'standard' | 'satellite' | 'hybrid';

const MAP_STYLES: Record<MapStyleKey, string | StyleSpecification> = {
  standard: MAP_STYLE_STANDARD,
  satellite: MAP_STYLE_SATELLITE,
  hybrid: MAP_STYLE_HYBRID,
};

const MAP_STYLE_ICONS: Record<MapStyleKey, keyof typeof Ionicons.glyphMap> = {
  standard: 'map-outline',
  satellite: 'globe-outline',
  hybrid: 'layers-outline',
};

const MAP_STYLE_LABELS: Record<MapStyleKey, string> = {
  standard: 'Standard',
  satellite: 'Satellite',
  hybrid: 'Hybrid',
};

/** Cycling order for the style-toggle button — Strava-style "Map Types" picker, minus "Winter"
 * (would need a paid tile provider) and a second OpenFreeMap vector variant (no independently
 * confirmed free style name beyond "liberty" was found anywhere in this repo or its dependencies,
 * so none was guessed — see CardioRouteMap.tsx's MAP_STYLE_STANDARD comment). */
const MAP_STYLE_ORDER: MapStyleKey[] = ['standard', 'satellite', 'hybrid'];

/** Mirrors theme/ThemeProvider.tsx's own AsyncStorage-backed preference pattern (read once on
 * mount, write on change) so the user's last-picked map style survives an app restart. */
const STYLE_PREF_KEY = 'flowsy-cardio-map-style-v1';

function isMapStyleKey(value: string | null): value is MapStyleKey {
  return value === 'standard' || value === 'satellite' || value === 'hybrid';
}

/** Live route map for the cardio "record with GPS" flow (followUser=true) and the static
 * post-run/history view (followUser=false) — MapLibre Native (Android & iOS) via
 * @maplibre/maplibre-react-native, rendering free OpenFreeMap vector tiles (or, if the user picks
 * Satellite or Hybrid, free Esri raster imagery, the latter with an Esri labels overlay stacked on
 * top). No Google Maps API key or billing required. (This replaces an earlier
 * react-native-maps/Google Maps implementation.) */
export function CardioRouteMap({ points, routeColor = '#3D8BFF', followUser = true, showStyleToggle = false }: Props) {
  const theme = useAppTheme();
  const lastPoint = points[points.length - 1];

  const [mapStyleKey, setMapStyleKey] = useState<MapStyleKey>('standard');

  useEffect(() => {
    if (!showStyleToggle) return;
    AsyncStorage.getItem(STYLE_PREF_KEY).then((stored) => {
      if (isMapStyleKey(stored)) setMapStyleKey(stored);
    });
    // Read once on mount only, same as ThemeProvider's themeName restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycleMapStyle = () => {
    const currentIndex = MAP_STYLE_ORDER.indexOf(mapStyleKey);
    const next = MAP_STYLE_ORDER[(currentIndex + 1) % MAP_STYLE_ORDER.length];
    setMapStyleKey(next);
    AsyncStorage.setItem(STYLE_PREF_KEY, next).catch(() => {});
  };

  // The India-wide fallback this replaces made the map open zoomed out to the whole country the
  // moment the recording screen mounted — before the tracking session had captured a single GPS
  // fix, `points` is empty and there was nothing else to center on. Fetching the device's actual
  // current position here (fast cached fix first, falling back to a fresh one) means the map
  // opens centered on the user immediately, even before their first RoutePoint exists.
  const [initialPosition, setInitialPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (lastPoint) return; // Already have a real route point — no need to fetch a separate fix.
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        let granted = status === 'granted';
        if (!granted) {
          // The recording screen requires location anyway (see useTrackingSession/start), but a
          // user can land on this screen before ever pressing Start, so permission may not be
          // confirmed yet at mount time — ask here too rather than showing the loading state
          // indefinitely. requestTrackingPermissions() (foreground + background) still runs when
          // recording actually starts; this is just the lighter foreground-only ask needed to
          // center the map.
          const requested = await Location.requestForegroundPermissionsAsync();
          granted = requested.status === 'granted';
        }
        if (!granted) return;

        // getLastKnownPositionAsync is near-instant (cached) but can be null (e.g. first launch
        // after install); getCurrentPositionAsync is slower but always tries for a fresh fix.
        const lastKnown = await Location.getLastKnownPositionAsync();
        const fix = lastKnown ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled && fix) {
          setInitialPosition({ lat: fix.coords.latitude, lng: fix.coords.longitude });
        }
      } catch {
        // Permission denied, location services off, timeout, etc. — fall through to the loading
        // state below rather than a hardcoded coordinate; it clears itself once real RoutePoints
        // start arriving from the tracking session.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (points.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
    };
  }, [points]);

  const centerPoint = lastPoint ? { lat: lastPoint.lat, lng: lastPoint.lng } : initialPosition;

  if (!centerPoint) {
    // Genuinely no location yet (permission still resolving, GPS still acquiring) — a brief
    // centering state instead of the old India-wide fallback, which showed a real (if wrong) map
    // and so read as a bug rather than a loading state.
    return (
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator color={theme.colors.textSecondary} />
        <Text style={{ marginTop: theme.spacing.sm, color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          Finding your location…
        </Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLES[mapStyleKey]} logo={false}>
        <Camera
          initialViewState={{ center: [centerPoint.lng, centerPoint.lat], zoom: 16 }}
          // Only `center` (never `zoom`) is passed on every subsequent update while following the
          // user — MapLibre RN's own camera-stop handling (checked in both the Android
          // (CameraStop.kt) and iOS (MLRNCamera.m) native sources) builds each update from the
          // *current* camera and only overrides zoom when a stop explicitly includes one, so a
          // center-only update here can't fight a manual pinch-zoom; `zoom` is set once, only in
          // initialViewState above, on mount.
          center={followUser && lastPoint ? [lastPoint.lng, lastPoint.lat] : undefined}
          trackUserLocation={followUser ? 'default' : undefined}
          duration={500}
        />
        {followUser ? <UserLocation animated /> : null}
        {routeGeoJSON ? (
          <GeoJSONSource id="cardioRoute" data={routeGeoJSON}>
            <Layer
              type="line"
              id="cardioRouteLine"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': routeColor, 'line-width': 4 }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
      {showStyleToggle ? (
        <Pressable
          onPress={cycleMapStyle}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: theme.spacing.md,
            right: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 6,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.surface,
            ...theme.shadow.sm,
          }}>
          <Ionicons name={MAP_STYLE_ICONS[mapStyleKey]} size={14} color={theme.colors.textPrimary} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
            {MAP_STYLE_LABELS[mapStyleKey]}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
