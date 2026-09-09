import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

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

/** Reads the `exercises` table seeded at migration time and kept fresh by
 * useExerciseCatalogSync — instant and works fully offline, since it never itself talks to
 * Firestore. Deliberately separate from modules/workout/exerciseLibrary.ts (the original bundled
 * JSON reader still used by the exercise picker/detail screen) rather than replacing it — this is
 * additive, for the catalog browser and anything that specifically needs synced media. */
export function useExerciseCatalog() {
  const db = useSQLiteContext();
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await db.getAllAsync<ExerciseRow>('SELECT * FROM exercises ORDER BY name ASC');
    setExercises(rows.map(fromRow));
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { exercises, loading, refresh };
}
