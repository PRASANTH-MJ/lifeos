export type MeditationSession = {
  key: string;
  title: string;
  description: string;
  durationSeconds: number;
  defaultTrackKey: string;
};

export type MeditationLog = {
  id: number;
  session_key: string;
  duration_seconds: number;
  completed_at: string;
};

export type MeditationTrack = {
  key: string;
  label: string;
  /** A bundled asset (require()'d number) or a device file URI for an imported track. */
  audioSource: number | string;
};

// Placeholder ambient tones (bundled locally per the offline-first decision) —
// swap `audioSource` for licensed guided-voice/music content later; nothing
// else about the player or the schema needs to change to do that.
export const MEDITATION_TRACKS: MeditationTrack[] = [
  { key: 'calm', label: 'Calm Pad', audioSource: require('../../assets/audio/calm-pad.wav') },
  { key: 'deep', label: 'Deep Pad', audioSource: require('../../assets/audio/deep-pad.wav') },
  { key: 'bright', label: 'Bright Pad', audioSource: require('../../assets/audio/bright-pad.wav') },
  { key: 'warm-drone', label: 'Warm Drone', audioSource: require('../../assets/audio/warm-drone.wav') },
  { key: 'crystal-chimes', label: 'Crystal Chimes', audioSource: require('../../assets/audio/crystal-chimes.wav') },
  { key: 'forest-hum', label: 'Forest Hum', audioSource: require('../../assets/audio/forest-hum.wav') },
];

export function findTrack(key: string): MeditationTrack {
  return MEDITATION_TRACKS.find((track) => track.key === key) ?? MEDITATION_TRACKS[0];
}

export const MEDITATION_SESSIONS: MeditationSession[] = [
  {
    key: 'calm-focus',
    title: 'Calm Focus',
    description: 'A soft ambient tone to settle a busy mind.',
    durationSeconds: 5 * 60,
    defaultTrackKey: 'calm',
  },
  {
    key: 'deep-rest',
    title: 'Deep Rest',
    description: 'A low, grounding tone for winding down before sleep.',
    durationSeconds: 10 * 60,
    defaultTrackKey: 'deep',
  },
  {
    key: 'morning-clarity',
    title: 'Morning Clarity',
    description: 'A brighter tone to start the day present and awake.',
    durationSeconds: 3 * 60,
    defaultTrackKey: 'bright',
  },
];

export function findSession(key: string): MeditationSession | undefined {
  return MEDITATION_SESSIONS.find((session) => session.key === key);
}
