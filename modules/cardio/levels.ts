export type LevelTier = { level: number; label: string; threshold: number };

/** Cumulative-distance tiers for Running/Walking/Hiking, in km. Roughly doubling gaps so early
 * levels come quickly (motivating) and later ones take real sustained effort. */
export const DISTANCE_LEVEL_TIERS: LevelTier[] = [
  { level: 1, label: 'Beginner', threshold: 0 },
  { level: 2, label: 'Mover', threshold: 10 },
  { level: 3, label: 'Jogger', threshold: 25 },
  { level: 4, label: 'Runner', threshold: 50 },
  { level: 5, label: 'Roadrunner', threshold: 100 },
  { level: 6, label: 'Distance Runner', threshold: 200 },
  { level: 7, label: 'Endurance Athlete', threshold: 400 },
  { level: 8, label: 'Ultra Athlete', threshold: 750 },
  { level: 9, label: 'Elite', threshold: 1200 },
  { level: 10, label: 'Legend', threshold: 2000 },
];

/** Cumulative-session-count tiers for Yoga/Sports, which have no distance concept. */
export const SESSION_LEVEL_TIERS: LevelTier[] = [
  { level: 1, label: 'Beginner', threshold: 0 },
  { level: 2, label: 'Regular', threshold: 5 },
  { level: 3, label: 'Committed', threshold: 15 },
  { level: 4, label: 'Dedicated', threshold: 30 },
  { level: 5, label: 'Devoted', threshold: 60 },
  { level: 6, label: 'Disciplined', threshold: 100 },
  { level: 7, label: 'Master', threshold: 175 },
  { level: 8, label: 'Grandmaster', threshold: 300 },
  { level: 9, label: 'Elite', threshold: 500 },
  { level: 10, label: 'Legend', threshold: 800 },
];

export type LevelProgress = {
  level: number;
  label: string;
  /** How far into the current level (0–1); always 0 at the final tier (nothing further to climb). */
  progress: number;
  currentThreshold: number;
  nextThreshold: number | null;
};

export function computeLevel(value: number, tiers: LevelTier[]): LevelProgress {
  let current = tiers[0];
  let next: LevelTier | undefined;
  for (let i = 0; i < tiers.length; i += 1) {
    if (value >= tiers[i].threshold) {
      current = tiers[i];
      next = tiers[i + 1];
    }
  }
  const progress = next ? Math.min(1, (value - current.threshold) / (next.threshold - current.threshold)) : 0;
  return { level: current.level, label: current.label, progress, currentThreshold: current.threshold, nextThreshold: next?.threshold ?? null };
}
