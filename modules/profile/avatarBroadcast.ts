type Listener = (url: string) => void;

const listeners = new Set<Listener>();

/** A remote avatar change (see useAvatarSync, mounted once at root) lands in local SQLite
 * immediately, but any already-focused screen holding a `useProfile()` instance has no reason to
 * re-read it — useFocusEffect only refires on the *next* focus, not on a background DB write.
 * This tiny broadcast lets useProfile() update its in-memory state the moment the write happens,
 * without adding a second Firestore listener per screen. */
export function broadcastAvatarUrl(url: string): void {
  listeners.forEach((listener) => listener(url));
}

export function subscribeToAvatarBroadcast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
