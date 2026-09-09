import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, type CameraRef, Map, type MapRef, GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';

import type { RoutePoint } from '@/modules/cardio';
import { useAppTheme } from '@/theme';

// Exported so callers that also drive a companion animation off the same timeline (e.g. the
// animated-GIF export's per-frame delay — see app/(tabs)/cardio/[activity]/save.tsx) can match
// it exactly instead of hardcoding a second copy of this number.
export const REVEAL_DURATION_MS = 1800;
const REVEAL_STEPS = 40;

/** Same free/keyless OpenFreeMap style used by CardioRouteMap — kept as a local constant here too
 * rather than importing across components, since this is a small literal and importing it would
 * create a slightly odd dependency between two otherwise-independent components. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export type RouteRevealMapHandle = {
  /** Snapshots the map's current frame (whatever's been revealed so far — call after
   * onRevealComplete fires for the full route) as a PNG file URI, for attaching to a feed post. */
  capture: () => Promise<string | null>;
};

type Props = {
  points: RoutePoint[];
  routeColor?: string;
  /** Fires once the reveal animation finishes drawing the full route. */
  onRevealComplete?: () => void;
  /** When set (and >= 1), captures this many evenly-spaced PNG snapshots across the reveal
   * animation itself — for the animated-GIF share option, see modules/social/gifExport.ts —
   * reported via `onFramesCaptured` once every checkpoint has settled. Rides on the same
   * `revealCount` state that already drives the visible reveal rather than any separate timing,
   * so the captured frames always match what was actually on screen. Omit to skip multi-frame
   * capture entirely; the single-shot `capture()` imperative method works independently either
   * way. */
  captureFrameCount?: number;
  /** Fires once all `captureFrameCount` checkpoints have settled, with whichever frames
   * succeeded (in reveal order — a checkpoint whose `createStaticMapImage` call failed or
   * returned null is dropped rather than aborting the rest, since a merely-incomplete GIF beats
   * none at all). Only ever called when `captureFrameCount` is set. */
  onFramesCaptured?: (frameUris: string[]) => void;
};

/** A static route map that animates its polyline drawing in from start to finish — the "line
 * becomes a video" reveal, Strava-style — with a start marker (green dot) and end marker
 * (checkered flag) once the route completes. Captured via `capture()` (MapLibre's
 * `createStaticMapImage`, which snapshots the map surface as currently rendered — the MapLibre
 * RN equivalent of react-native-maps' `takeSnapshot`) to get a shareable PNG for a Feed post;
 * this component itself never posts anything. */
export const RouteRevealMap = forwardRef<RouteRevealMapHandle, Props>(function RouteRevealMap(
  { points, routeColor = '#FF6B35', onRevealComplete, captureFrameCount, onFramesCaptured },
  ref
) {
  const theme = useAppTheme();
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [revealCount, setRevealCount] = useState(points.length > 1 ? 2 : points.length);
  const [mapReady, setMapReady] = useState(false);
  // `mapReady` (onDidFinishLoadingMap) only means the style JSON has loaded — the actual map
  // TILES can still be fetching/painting for a short while after that, a well-known gotcha with
  // tile-based map SDKs generally. A snapshot taken the instant mapReady flips can capture a
  // still-blank or half-painted map. This extra flag adds a fixed settle window after mapReady
  // before anything is allowed to start capturing, giving tiles a real chance to actually be on
  // screen first.
  const [tilesSettled, setTilesSettled] = useState(false);

  useEffect(() => {
    if (!mapReady) return;
    const timeout = setTimeout(() => setTilesSettled(true), 900);
    return () => clearTimeout(timeout);
  }, [mapReady]);

  // `onDidFinishLoadingMap` can simply never fire on a real device — a network hiccup while the
  // style JSON is fetching, an OpenFreeMap outage, or just an unusually slow load — and until now
  // nothing here ever recovered from that: `mapReady`/`tilesSettled` stayed false forever, the
  // reveal timer below (gated on `tilesSettled`) never started, `onRevealComplete` never fired,
  // `routeSnapshotUri`/`gifUri` upstream (save.tsx) never got set, and the Route/GIF share option
  // — which only appears once a route snapshot exists — silently never appeared, with no error
  // surfaced anywhere. This fallback timeout means a hung or failed map load still unblocks the
  // rest of the pipeline after a few seconds (best-effort — the capture may end up showing a bare
  // or partially-tiled map rather than never happening at all).
  useEffect(() => {
    if (mapReady) return;
    const timeout = setTimeout(() => setMapReady(true), 6000);
    return () => clearTimeout(timeout);
  }, [mapReady]);

  const captureWithRetries = async (): Promise<string | null> => {
    if (!mapRef.current) return null;
    // A snapshot attempted before the map has actually finished loading/painting its tiles can
    // fail here (createStaticMapImage has nothing real to snapshot yet) — retrying with backoff
    // covers that race without the caller needing to know or care about it. This used to be a
    // single silent, un-retried attempt, which is why the Route/map-GIF share option could vanish
    // entirely on a real multi-point route: the reveal timer completes on its own fixed schedule
    // regardless of whether the map was visually ready, so a capture attempted right as it fires
    // could lose the race with no way to recover.
    for (const delayMs of [0, 400, 900]) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        const uri = await mapRef.current.createStaticMapImage({ output: 'file' });
        if (uri) return uri;
      } catch {
        // fall through to the next retry
      }
    }
    return null;
  };

  useImperativeHandle(ref, () => ({
    capture: captureWithRetries,
  }));

  useEffect(() => {
    // Previously started counting the instant this component mounted, regardless of whether the
    // map had actually finished loading yet (`mapReady` was only ever checked by the multi-frame
    // GIF capture path below, never by this one) — on a page with a lot else mounted at once, the
    // map can genuinely take longer than REVEAL_DURATION_MS to load, and this timer would still
    // complete and call onRevealComplete → capture() on schedule regardless, snapshotting a map
    // with nothing rendered on it yet. Waiting for `tilesSettled` here means the reveal (and the
    // capture it leads to) only ever starts once there's actually something real to reveal.
    if (points.length < 2 || !tilesSettled) return;
    const stepSize = Math.max(1, Math.ceil(points.length / REVEAL_STEPS));
    const intervalMs = REVEAL_DURATION_MS / REVEAL_STEPS;
    const interval = setInterval(() => {
      setRevealCount((count) => {
        const next = Math.min(count + stepSize, points.length);
        if (next >= points.length) {
          clearInterval(interval);
          onRevealComplete?.();
        }
        return next;
      });
    }, intervalMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, tilesSettled]);

  // Evenly-spaced `revealCount` values to snapshot at, computed once per (points, frame count)
  // pair — e.g. captureFrameCount=12 over a 200-point route picks 12 revealCount checkpoints
  // spread between the first couple of points and the full route.
  const frameCheckpoints = useMemo(() => {
    if (!captureFrameCount || captureFrameCount < 1 || points.length < 2) return [];
    const checkpoints = new Set<number>();
    for (let i = 1; i <= captureFrameCount; i++) {
      checkpoints.add(Math.min(points.length, Math.max(2, Math.round((points.length * i) / captureFrameCount))));
    }
    return Array.from(checkpoints).sort((a, b) => a - b);
  }, [points.length, captureFrameCount]);

  // Captured frame URIs, indexed by checkpoint position (not push order) — createStaticMapImage
  // is async and successive checkpoints can overlap in flight, so writing to a fixed index (set
  // at the moment each checkpoint is dispatched) keeps frames in reveal order even if a later
  // checkpoint's snapshot happens to resolve before an earlier one's.
  const capturedFramesRef = useRef<(string | null)[]>([]);
  const nextCheckpointIndexRef = useRef(0);
  const settledCountRef = useRef(0);

  useEffect(() => {
    capturedFramesRef.current = frameCheckpoints.map(() => null);
    nextCheckpointIndexRef.current = 0;
    settledCountRef.current = 0;
  }, [frameCheckpoints]);

  useEffect(() => {
    if (frameCheckpoints.length === 0 || !tilesSettled) return;
    const checkpointIndex = nextCheckpointIndexRef.current;
    const checkpoint = frameCheckpoints[checkpointIndex];
    if (checkpoint === undefined || revealCount < checkpoint) return;
    nextCheckpointIndexRef.current += 1;
    (async () => {
      // Same retry-with-backoff as the single-shot capture() above, not just one bare attempt —
      // a mid-sequence frame is just as susceptible to the tiles-not-painted-yet race as the
      // final one is, and losing one frame silently degrades the GIF rather than failing loudly.
      const uri = await captureWithRetries();
      capturedFramesRef.current[checkpointIndex] = uri;
      settledCountRef.current += 1;
      if (settledCountRef.current >= frameCheckpoints.length) {
        onFramesCaptured?.(capturedFramesRef.current.filter((u): u is string => u != null));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealCount, frameCheckpoints, tilesSettled]);

  // Fires when MapLibre gives up loading the style/tiles outright (as opposed to just being slow,
  // which the fallback timeout above covers) — e.g. a DNS failure or the tile host being down.
  // Treated the same as a successful load: better to unblock the reveal/capture pipeline (even onto
  // a blank map) than to leave the Route/GIF share option missing with no explanation.
  const onMapLoadFailed = () => setMapReady(true);

  const onMapLoaded = () => {
    setMapReady(true);
    if (points.length === 0) return;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const bounds: [number, number, number, number] = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    cameraRef.current?.fitBounds(bounds, { padding: { top: 40, right: 40, bottom: 40, left: 40 } });
  };

  const revealedGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (revealCount < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: points.slice(0, revealCount).map((p) => [p.lng, p.lat]) },
    };
  }, [points, revealCount]);

  const start = points[0];
  const end = revealCount >= points.length ? points[points.length - 1] : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} logo={false} dragPan={false} touchZoom={false} touchRotate={false} touchPitch={false} onDidFinishLoadingMap={onMapLoaded} onDidFailLoadingMap={onMapLoadFailed} ref={mapRef}>
        <Camera ref={cameraRef} />
        {mapReady && revealedGeoJSON ? (
          <GeoJSONSource id="routeReveal" data={revealedGeoJSON}>
            <Layer
              type="line"
              id="routeRevealLine"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': routeColor, 'line-width': 4 }}
            />
          </GeoJSONSource>
        ) : null}
        {mapReady && start ? (
          <Marker lngLat={[start.lng, start.lat]} anchor="center">
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.success, borderWidth: 2, borderColor: '#fff' }} />
          </Marker>
        ) : null}
        {mapReady && end ? (
          <Marker lngLat={[end.lng, end.lat]} anchor="center">
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: routeColor,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#fff',
              }}>
              <Ionicons name="flag" size={12} color="#fff" />
            </View>
          </Marker>
        ) : null}
      </Map>
    </View>
  );
});
