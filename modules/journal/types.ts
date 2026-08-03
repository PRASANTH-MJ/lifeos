export type JournalEntry = {
  id: number;
  body: string;
  mood: string | null;
  prompt: string | null;
  created_at: string;
  updated_at: string;
};

export const MOODS = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'low', emoji: '😕', label: 'Low' },
  { key: 'rough', emoji: '😣', label: 'Rough' },
] as const;

export const JOURNAL_PROMPTS = [
  "What's on your mind right now?",
  'What are you grateful for today?',
  'Describe a moment that stood out today.',
  "What's weighing on you, and what's one small step forward?",
  'What did you learn about yourself today?',
];

export function moodEmoji(mood: string | null): string {
  return MOODS.find((option) => option.key === mood)?.emoji ?? '📝';
}

export type SleepBucket = 'under_3' | '3_to_6' | '5_to_7' | '7_plus';

export const SLEEP_BUCKETS: { key: SleepBucket; label: string }[] = [
  { key: 'under_3', label: '<3h' },
  { key: '3_to_6', label: '3-6h' },
  { key: '5_to_7', label: '5-7h' },
  { key: '7_plus', label: '7+h' },
];

export type FirstReachedFor = 'water' | 'coffee' | 'phone' | 'food';

export const FIRST_REACHED_FOR_OPTIONS: { key: FirstReachedFor; label: string; icon: string }[] = [
  { key: 'water', label: 'Water', icon: 'water' },
  { key: 'coffee', label: 'Coffee', icon: 'cafe' },
  { key: 'phone', label: 'Phone', icon: 'phone-portrait' },
  { key: 'food', label: 'Food', icon: 'restaurant' },
];

export type JournalCheckin = {
  id: number;
  date: string;
  type: 'morning' | 'night';
  energy: number | null;
  sleep_bucket: SleepBucket | null;
  stress: number | null;
  first_reached_for: FirstReachedFor | null;
  productivity: number | null;
  mood: string | null;
  created_at: string;
  updated_at: string;
};

export type MorningCheckinInput = {
  energy: number | null;
  sleepBucket: SleepBucket | null;
  stress: number | null;
  firstReachedFor: FirstReachedFor | null;
  mood: string | null;
};

export type NightCheckinInput = {
  productivity: number | null;
  mood: string | null;
};
