import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';

export type CatalogExercise = {
  key: string;
  name: string;
  category: string;
  muscles: string[];
  musclesSecondary: string[];
  equipment: string[];
  description: string;
  imageUrl: string | null;
  gifUrl: string | null;
  videoUrl: string | null;
  source: string;
};

type ExerciseRow = {
  key: string;
  name: string;
  category: string;
  muscles: string;
  muscles_secondary: string;
  equipment: string;
  description: string;
  image_url: string | null;
  gif_url: string | null;
  video_url: string | null;
  source: string;
};

function fromRow(row: ExerciseRow): CatalogExercise {
  return {
    key: row.key,
    name: row.name,
    category: row.category,
    muscles: JSON.parse(row.muscles),
    musclesSecondary: JSON.parse(row.muscles_secondary),
    equipment: JSON.parse(row.equipment),
    description: row.description,
    imageUrl: row.image_url,
    gifUrl: row.gif_url,
    videoUrl: row.video_url,
    source: row.source,
  };
}

/** Web build of useExerciseCatalog.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: any tab (or the sync engine) writing to the
 * `exercises` table makes every mounted instance of this hook re-render automatically, so no
 * manual refresh() call is needed (kept as a no-op-returning function only so callers that
 * awaited it don't need changing). */
export function useExerciseCatalog() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.exercises.toArray()) as unknown as ExerciseRow[];
    return [...all].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }, []);

  const loading = rows === undefined;
  const exercises = (rows ?? []).map(fromRow);

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  return { exercises, loading, refresh };
}
