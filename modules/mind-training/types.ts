export type MindExerciseKey =
  | 'reaction'
  | 'sequence'
  | 'go-no-go'
  | 'digit-span'
  | 'math-sprint'
  | 'stroop'
  | 'whack-a-mole'
  | 'memory-match'
  | 'flanker'
  | 'odd-one-out'
  | 'balloon-risk';

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
  {
    key: 'digit-span',
    title: 'Digit Span',
    description: 'Watch the digits, then tap them back in order.',
    scoreLabel: 'digits',
    lowerIsBetter: false,
  },
  {
    key: 'math-sprint',
    title: 'Math Sprint',
    description: 'Answer as many quick sums as you can in 30 seconds.',
    scoreLabel: 'correct',
    lowerIsBetter: false,
  },
  {
    key: 'stroop',
    title: 'Color Match',
    description: 'Tap the ink color a word is printed in — not what it says.',
    scoreLabel: '% accuracy',
    lowerIsBetter: false,
  },
  {
    key: 'whack-a-mole',
    title: 'Whack-a-Mole',
    description: 'Tap each tile the instant it lights up.',
    scoreLabel: '% accuracy',
    lowerIsBetter: false,
  },
  {
    key: 'memory-match',
    title: 'Memory Match',
    description: 'Flip tiles to find all 8 matching pairs.',
    scoreLabel: 'moves',
    lowerIsBetter: true,
  },
  {
    key: 'flanker',
    title: 'Flanker Task',
    description: 'Tap the direction of the middle arrow — ignore the ones around it.',
    scoreLabel: '% accuracy',
    lowerIsBetter: false,
  },
  {
    key: 'odd-one-out',
    title: 'Odd One Out',
    description: 'Spot the icon that\'s different from the rest, before time runs out.',
    scoreLabel: '% accuracy',
    lowerIsBetter: false,
  },
  {
    key: 'balloon-risk',
    title: 'Balloon Risk',
    description: 'Pump each balloon for points, and cash out before it pops.',
    scoreLabel: 'points',
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
