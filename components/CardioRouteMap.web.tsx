import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import type { RoutePoint } from '@/modules/cardio';
import { useAppTheme } from '@/theme';

type Props = {
  points: RoutePoint[];
  routeColor?: string;
  followUser?: boolean;
  showStyleToggle?: boolean;
};

/** Web build of CardioRouteMap — @maplibre/maplibre-react-native is a native-only binding with no
 * web target, so this twin keeps it out of the web bundle entirely (same reasoning as
 * record.web.tsx). There's no tiled-map dependency installed for web (that would be a separate
 * package, maplibre-gl-js, not this native binding), so this draws just the route's shape as a
 * plain SVG polyline scaled to fit its box — no basemap tiles, but a synced route created on
 * mobile is still visible here rather than showing nothing at all. `followUser` has no meaning
 * without live location tracking (native-only) and is accepted only for prop-compatibility with
 * the native component. */
export function CardioRouteMap({ points, routeColor = '#3D8BFF' }: Props) {
  const theme = useAppTheme();

  if (points.length < 2) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.surface }} />;
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 1;
  const lngSpan = maxLng - minLng || 1;
  const padding = 10;
  const size = 100 - padding * 2;

  // Flip vertically (SVG y grows downward, latitude grows northward/upward) and normalize into a
  // 0-100 viewBox so the box scales with whatever container it's given.
  const svgPoints = points
    .map((p) => {
      const x = padding + ((p.lng - minLng) / lngSpan) * size;
      const y = padding + (1 - (p.lat - minLat) / latSpan) * size;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <Polyline points={svgPoints} fill="none" stroke={routeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
