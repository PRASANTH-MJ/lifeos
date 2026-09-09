import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';
import { webDb } from '@/db/webDb';

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

/** Web equivalent of the native `INSERT ... ON CONFLICT(key) DO UPDATE` upsert: look up the
 * existing row by the unique `key` index, then either update it in place (preserving its
 * `created_at`/id) or add a brand-new row. */
async function upsertExercise(doc: ExerciseDoc, now: string) {
  const existing = await webDb.exercises.where('key').equals(doc.key).first();
  const fields = {
    key: doc.key,
    name: doc.name,
    category: doc.category,
    muscles: JSON.stringify(doc.muscles ?? []),
    muscles_secondary: JSON.stringify(doc.musclesSecondary ?? []),
    equipment: JSON.stringify(doc.equipment ?? []),
    description: doc.description ?? '',
    image_url: doc.imageUrl ?? null,
    gif_url: doc.gifUrl ?? null,
    video_url: doc.videoUrl ?? null,
    source: doc.source ?? 'firestore',
    source_id: doc.sourceId ?? null,
    updated_at: now,
  };
  if (existing) {
    await webDb.exercises.update((existing as { id: number }).id, fields);
  } else {
    await webDb.exercises.add({ ...fields, created_at: now });
  }
}

/** Programs are small and always fully replaced (not merged) — a program with removed/reordered
 * days is expected to fully overwrite what's local, unlike exercises which are upserted one at a
 * time since there are far more of them and no single sync run is guaranteed to see every key. */
async function replaceProgram(doc: ProgramDoc, now: string) {
  const existing = await webDb.programs.where('key').equals(doc.key).first();
  const fields = {
    key: doc.key,
    title: doc.title,
    description: doc.description ?? '',
    goal: doc.goal ?? 'general',
    equipment: doc.equipment ?? 'none',
    weeks: doc.weeks ?? 1,
    source: 'firestore',
    updated_at: now,
  };
  if (existing) {
    await webDb.programs.update((existing as { id: number }).id, fields);
  } else {
    await webDb.programs.add({ ...fields, created_at: now });
  }

  const existingDays = await webDb.program_days.where('program_key').equals(doc.key).toArray();
  await webDb.program_days.bulkDelete(existingDays.map((row) => (row as { id: number }).id));

  const existingExercises = (await webDb.program_exercises.toArray()).filter(
    (row) => (row as { program_key: string }).program_key === doc.key
  );
  await webDb.program_exercises.bulkDelete(existingExercises.map((row) => (row as { id: number }).id));

  for (const [dayIndex, day] of (doc.days ?? []).entries()) {
    await webDb.program_days.add({
      program_key: doc.key,
      day_key: day.key,
      title: day.title,
      sort_order: dayIndex,
    });
    for (const [exerciseIndex, exercise] of (day.exercises ?? []).entries()) {
      await webDb.program_exercises.add({
        program_key: doc.key,
        day_key: day.key,
        exercise_key: exercise.exerciseKey,
        sets: exercise.sets,
        reps: exercise.reps,
        note: exercise.note ?? null,
        sort_order: exerciseIndex,
      });
    }
  }
}

/** Pulls the shared exercise/program catalog down from Firestore and upserts it into local
 * IndexedDB (via Dexie), keyed on `key`. Purely additive/refreshing — never touches user data
 * (logs, progress). Read-only screens (the catalog browser, exercise picker) keep working from
 * whatever's already local while this runs, so a slow or offline sync never blocks anything;
 * call `syncNow()` from a pull-to-refresh rather than relying only on the automatic on-mount
 * sync.
 *
 * Web note: unlike most ported modules, this hook doesn't use useLiveQuery — it exposes sync
 * *progress* state (syncing/lastSyncedAt/error), not a reactive view of catalog data. Screens
 * that read exercises/programs do their own useLiveQuery reads elsewhere and will pick up the
 * writes this hook makes automatically once it commits them.
 */
export function useExerciseCatalogSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    // Web has no bundled seed for exercises/programs (unlike native's SQLite migrations) — this
    // pull is the ONLY way those tables ever get populated, so a single transient network blip
    // must not leave the catalog permanently empty. Retry a few times with backoff before giving up.
    const MAX_ATTEMPTS = 3;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const now = new Date().toISOString();
        const [exerciseSnapshot, programSnapshot] = await Promise.all([
          getDocs(collection(firestore, 'exercises')),
          getDocs(collection(firestore, 'programs')),
        ]);
        await webDb.transaction(
          'rw',
          [webDb.exercises, webDb.programs, webDb.program_days, webDb.program_exercises],
          async () => {
            for (const docSnap of exerciseSnapshot.docs) {
              await upsertExercise(docSnap.data() as ExerciseDoc, now);
            }
            for (const docSnap of programSnapshot.docs) {
              await replaceProgram(docSnap.data() as ProgramDoc, now);
            }
          }
        );
        setLastSyncedAt(now);
        setSyncing(false);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
    // Still failing after retries — offline or Firestore unreachable. Log with enough detail to
    // debug in production (this silently-caught path is exactly what left the catalog looking
    // empty with no trace), then surface `error` so screens with nothing local yet can tell "still
    // loading" apart from "genuinely broken" instead of rendering a bare empty-state.
    console.error('[useExerciseCatalogSync] Firestore sync failed after retries:', lastErr);
    setError('Could not refresh the exercise catalog — showing what was last saved on this device.');
    setSyncing(false);
  }, []);

  useEffect(() => {
    syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { syncing, lastSyncedAt, error, syncNow };
}
