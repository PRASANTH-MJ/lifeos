export type MindExerciseKey = 'reaction' | 'sequence' | 'go-no-go';

export type MindExercise = {
  key: MindExerciseKey;
  title: string;
  description: string;
  scoreLabel: string;
  /** Whether a lower score is better (e.g. reaction time) or higher is better (e.g. accuracy, level). */
  lowerIsBetter: boolean;
};

export const MIND_EXERCISES: MindExercise[] = [
  {
    key: 'reaction',
    title: 'Reaction Time',
    description: 'Tap the moment the screen turns green.',
    scoreLabel: 'ms',
    lowerIsBetter: true,
  },
  {
    key: 'sequence',
    title: 'Sequence Memory',
    description: 'Repeat the growing pattern of tiles.',
    scoreLabel: 'level',
    lowerIsBetter: false,
  },
  {
    key: 'go-no-go',
    title: 'Go / No-Go',
    description: 'Tap green circles, ignore red ones.',
    scoreLabel: '% accuracy',
    lowerIsBetter: false,
  },
];

export function findExercise(key: string): MindExercise | undefined {
  return MIND_EXERCISES.find((exercise) => exercise.key === key);
}

export type MindTrainingLog = {
  id: number;
  exercise_key: string;
  score: number;
  completed_at: string;
};
