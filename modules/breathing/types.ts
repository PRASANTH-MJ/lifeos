export type BreathingStep = {
  label: 'Inhale' | 'Hold' | 'Exhale';
  seconds: number;
};

export type BreathingPattern = {
  key: string;
  title: string;
  description: string;
  steps: BreathingStep[];
};

export type BreathingLog = {
  id: number;
  pattern_key: string;
  duration_seconds: number;
  cycles: number;
  completed_at: string;
};

export const BREATHING_PATTERNS: BreathingPattern[] = [
  {
    key: 'box',
    title: 'Box Breathing',
    description: 'Even 4-4-4-4 pacing used to steady focus under pressure.',
    steps: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold', seconds: 4 },
      { label: 'Exhale', seconds: 4 },
      { label: 'Hold', seconds: 4 },
    ],
  },
  {
    key: '4-7-8',
    title: '4-7-8',
    description: 'A longer exhale to calm the nervous system before sleep.',
    steps: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold', seconds: 7 },
      { label: 'Exhale', seconds: 8 },
    ],
  },
  {
    key: 'coherent',
    title: 'Coherent Breathing',
    description: 'Simple even 5-5 pacing for everyday steadiness.',
    steps: [
      { label: 'Inhale', seconds: 5 },
      { label: 'Exhale', seconds: 5 },
    ],
  },
];

export function findPattern(key: string): BreathingPattern | undefined {
  return BREATHING_PATTERNS.find((pattern) => pattern.key === key);
}
