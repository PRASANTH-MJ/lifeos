import type { useRouter } from 'expo-router';

export type PickedExercise = { key: string; name: string };
type PickerCallback = (exercises: PickedExercise[]) => void;

// A one-shot in-memory bridge for returning a result from the Exercise Library's picker mode —
// expo-router's file-based routing has no built-in "return a value to the caller" mechanism, and
// this is a same-process, single-session hand-off so a module-level singleton is sufficient
// (no persistence needed, unlike AsyncStorage-backed state elsewhere in this module). Carries
// {key, name} rather than bare keys so callers never have to re-resolve a name from their OWN
// (possibly not-yet-loaded) copy of the catalog — the picker screen already has the live list.
let pendingCallback: PickerCallback | null = null;

export function openExercisePicker(router: ReturnType<typeof useRouter>, onPick: PickerCallback) {
  pendingCallback = onPick;
  router.push({ pathname: '/workout/exercises', params: { mode: 'pick' } });
}

export function resolveExercisePicker(exercises: PickedExercise[]) {
  pendingCallback?.(exercises);
  pendingCallback = null;
}
