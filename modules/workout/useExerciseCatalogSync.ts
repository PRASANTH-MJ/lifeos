import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { firestore } from '@/firebase/config';

type ExerciseDoc = {
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
  sourceId: string | null;
};

type ProgramDoc = {
  key: string;
  title: string;
  description: string;
  goal: string;
  equipment: string;
  weeks: number;
  days: Array<{ key: string; title: string; exercises: Array<{ exerciseKey: string; sets: number; reps: number; note?: string }> }>;
};

async function upsertExercise(db: SQLiteDatabase, doc: ExerciseDoc, now: string) {
  await db.runAsync(
    `INSERT INTO exercises (key, name, category, muscles, muscles_secondary, equipment, description, image_url, gif_url, video_url, source, source_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       name = excluded.name, category = excluded.category, muscles = excluded.muscles,
       muscles_secondary = excluded.muscles_secondary, equipment = excluded.equipment,
       description = excluded.description, image_url = excluded.image_url, gif_url = excluded.gif_url,
       video_url = excluded.video_url, source = excluded.source, source_id = excluded.source_id, updated_at = excluded.updated_at`,
    [
      doc.key,
      doc.name,
      doc.category,
      JSON.stringify(doc.muscles ?? []),
      JSON.stringify(doc.musclesSecondary ?? []),
      JSON.stringify(doc.equipment ?? []),
      doc.description ?? '',
      doc.imageUrl ?? null,
      doc.gifUrl ?? null,
      doc.videoUrl ?? null,
      doc.source ?? 'firestore',
      doc.sourceId ?? null,
      now,
      now,
    ]
  );
}

/** Programs are small and always fully replaced (not merged) — a program with removed/reordered
 * days is expected to fully overwrite what's local, unlike exercises which are upserted one at a
 * time since there are far more of them and no single sync run is guaranteed to see every key. */
async function replaceProgram(db: SQLiteDatabase, doc: ProgramDoc, now: string) {
  await db.runAsync(
    `INSERT INTO programs (key, title, description, goal, equipment, weeks, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'firestore', ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       title = excluded.title, description = excluded.description, goal = excluded.goal,
       equipment = excluded.equipment, weeks = excluded.weeks, source = excluded.source, updated_at = excluded.updated_at`,
    [doc.key, doc.title, doc.description ?? '', doc.goal ?? 'general', doc.equipment ?? 'none', doc.weeks ?? 1, now, now]
  );
  await db.runAsync('DELETE FROM program_days WHERE program_key = ?', [doc.key]);
  await db.runAsync('DELETE FROM program_exercises WHERE program_key = ?', [doc.key]);
  for (const [dayIndex, day] of (doc.days ?? []).entries()) {
    await db.runAsync('INSERT INTO program_days (program_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)', [
      doc.key,
      day.key,
      day.title,
      dayIndex,
    ]);
    for (const [exerciseIndex, exercise] of (day.exercises ?? []).entries()) {
      await db.runAsync(
        'INSERT INTO program_exercises (program_key, day_key, exercise_key, sets, reps, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [doc.key, day.key, exercise.exerciseKey, exercise.sets, exercise.reps, exercise.note ?? null, exerciseIndex]
      );
    }
  }
}

/** Pulls the shared exercise/program catalog down from Firestore and upserts it into local
 * SQLite, keyed on `key`. Purely additive/refreshing — never touches user data (logs, progress).
 * Read-only screens (the catalog browser, exercise picker) keep working from whatever's already
 * local while this runs, so a slow or offline sync never blocks anything; call `syncNow()` from a
 * pull-to-refresh rather than relying only on the automatic on-mount sync. */
export function useExerciseCatalogSync() {
  const db = useSQLiteContext();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    // Bundled SQLite migrations already seed a starter catalog, so native never shows a truly
    // empty screen the way web can — but retry with backoff anyway rather than giving up on the
    // first transient network blip, and log with enough detail to debug in production instead of
    // swallowing the error silently.
    const MAX_ATTEMPTS = 3;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const now = new Date().toISOString();
        const [exerciseSnapshot, programSnapshot] = await Promise.all([
          getDocs(collection(firestore, 'exercises')),
          getDocs(collection(firestore, 'programs')),
        ]);
        for (const docSnap of exerciseSnapshot.docs) {
          await upsertExercise(db, docSnap.data() as ExerciseDoc, now);
        }
        for (const docSnap of programSnapshot.docs) {
          await replaceProgram(db, docSnap.data() as ProgramDoc, now);
        }
        setLastSyncedAt(now);
        setSyncing(false);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
    console.error('[useExerciseCatalogSync] Firestore sync failed after retries:', lastErr);
    // Offline or Firestore unreachable — the bundled/previously-synced catalog already in
    // SQLite stays exactly as it was, so this is silent-safe rather than surfaced as a blocker.
    setError('Could not refresh the exercise catalog — showing what was last saved on this device.');
    setSyncing(false);
  }, [db]);

  useEffect(() => {
    syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { syncing, lastSyncedAt, error, syncNow };
}
