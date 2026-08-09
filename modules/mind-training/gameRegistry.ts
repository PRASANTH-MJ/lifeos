import type { ComponentType } from 'react';

import { BalloonRiskGame } from './games/BalloonRiskGame';
import { DigitSpanGame } from './games/DigitSpanGame';
import { FlankerGame } from './games/FlankerGame';
import { GoNoGoGame } from './games/GoNoGoGame';
import { MathSprintGame } from './games/MathSprintGame';
import { MemoryMatchGame } from './games/MemoryMatchGame';
import { OddOneOutGame } from './games/OddOneOutGame';
import { ReactionGame } from './games/ReactionGame';
import { SequenceGame } from './games/SequenceGame';
import { StroopGame } from './games/StroopGame';
import { WhackAMoleGame } from './games/WhackAMoleGame';
import type { MindExerciseKey } from './types';

type GameComponent = ComponentType<{ onScore: (score: number) => void }>;

// One entry per MindExerciseKey — the runner screen (app/(tabs)/mind-training/[exerciseKey].tsx)
// looks up this map instead of a hardcoded if-chain, so adding a new exercise is just one line
// here plus one MIND_EXERCISES entry, not a screen edit.
export const GAME_COMPONENTS: Record<MindExerciseKey, GameComponent> = {
  reaction: ReactionGame,
  sequence: SequenceGame,
  'go-no-go': GoNoGoGame,
  'digit-span': DigitSpanGame,
  'math-sprint': MathSprintGame,
  stroop: StroopGame,
  'whack-a-mole': WhackAMoleGame,
  'memory-match': MemoryMatchGame,
  flanker: FlankerGame,
  'odd-one-out': OddOneOutGame,
  'balloon-risk': BalloonRiskGame,
};
