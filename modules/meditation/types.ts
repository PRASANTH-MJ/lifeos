export type MeditationSession = {
  key: string;
  title: string;
  description: string;
  durationSeconds: number;
  audioSource: number;
};

export type MeditationLog = {
  id: number;
  session_key: string;
  duration_seconds: number;
  completed_at: string;
};

// Placeholder ambient tones (bundled locally per the offline-first decision) —
// swap `audioSource` for licensed guided-voice content later; nothing else
// about the player or the schema needs to change to do that.
export const MEDITATION_SESSIONS: MeditationSession[] = [
  {
    key: 'calm-focus',
    title: 'Calm Focus',
    description: 'A soft ambient tone to settle a busy mind.',
    durationSeconds: 5 * 60,
    audioSource: require('../../assets/audio/calm-pad.wav'),
  },
  {
    key: 'deep-rest',
    title: 'Deep Rest',
    description: 'A low, grounding tone for winding down before sleep.',
    durationSeconds: 10 * 60,
    audioSource: require('../../assets/audio/deep-pad.wav'),
  },
  {
    key: 'morning-clarity',
    title: 'Morning Clarity',
    description: 'A brighter tone to start the day present and awake.',
    durationSeconds: 3 * 60,
    audioSource: require('../../assets/audio/bright-pad.wav'),
  },
];

export function findSession(key: string): MeditationSession | undefined {
  return MEDITATION_SESSIONS.find((session) => session.key === key);
}
