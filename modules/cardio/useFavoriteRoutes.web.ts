import { useCallback } from 'react';

import { useLocalTable } from '@/db/useLocalTable.web';
import type { CardioFavoriteRoute } from './favoriteRoutes';
import type { CardioActivity } from './types';

type CardioFavoriteRouteRow = {
  id: number;
  activity: string;
  label: string;
  start_lat: number;
  start_lng: number;
  distance_km: number;
  created_at: string;
};

function toFavorite(row: CardioFavoriteRouteRow): CardioFavoriteRoute {
  return { id: row.id, activity: row.activity as CardioActivity, label: row.label, startLat: row.start_lat, startLng: row.start_lng, distanceKm: row.distance_km };
}

/** Web build of useFavoriteRoutes.ts — same exported shape. */
export function useFavoriteRoutes() {
  const table = useLocalTable<CardioFavoriteRouteRow>('cardio_favorite_routes', {
    sort: (a, b) => b.created_at.localeCompare(a.created_at),
  });

  const addFavorite = useCallback(
    (values: { activity: CardioActivity; label: string; startLat: number; startLng: number; distanceKm: number }) => {
      return table.insert({
        activity: values.activity,
        label: values.label,
        start_lat: values.startLat,
        start_lng: values.startLng,
        distance_km: values.distanceKm,
        created_at: new Date().toISOString(),
      } as Partial<CardioFavoriteRouteRow>);
    },
    [table]
  );

  const removeFavorite = useCallback((id: number) => table.remove(id), [table]);

  return { favorites: table.rows.map(toFavorite), loading: table.loading, addFavorite, removeFavorite, refresh: table.refresh };
}
