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
