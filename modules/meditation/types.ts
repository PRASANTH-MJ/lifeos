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

// Real bundled ambient/music tracks (replaced the earlier generated
// placeholder tones) — bundled locally, fully offline, same as before.
export const MEDITATION_TRACKS: MeditationTrack[] = [
  { key: 'moonstone', label: 'Moonstone', audioSource: require('../../assets/audio/moonstone.mp3') },
  { key: 'ocean-wave', label: 'Ocean Wave', audioSource: require('../../assets/audio/ocean-wave.mp3') },
  { key: 'bright-halo', label: 'Bright Halo', audioSource: require('../../assets/audio/bright-halo.mp3') },
  { key: 'li-river', label: 'Li River', audioSource: require('../../assets/audio/li-river.mp3') },
  { key: 'crystal', label: 'Crystal', audioSource: require('../../assets/audio/crystal.mp3') },
  { key: 'flashes', label: 'Flashes', audioSource: require('../../assets/audio/flashes.mp3') },
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
    defaultTrackKey: 'moonstone',
  },
  {
    key: 'deep-rest',
    title: 'Deep Rest',
    description: 'A low, grounding tone for winding down before sleep.',
    durationSeconds: 10 * 60,
    defaultTrackKey: 'ocean-wave',
  },
  {
    key: 'morning-clarity',
    title: 'Morning Clarity',
    description: 'A brighter tone to start the day present and awake.',
    durationSeconds: 3 * 60,
    defaultTrackKey: 'bright-halo',
  },
];

export function findSession(key: string): MeditationSession | undefined {
  return MEDITATION_SESSIONS.find((session) => session.key === key);
}
