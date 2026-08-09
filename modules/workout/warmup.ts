// Universal sequences bookending every Session Mode workout — same "Name — duration/reps" string
// format as Workout.exercises, so they reuse the session screen's existing line-parsing and
// auto-countdown logic with no special-casing. Ordered head-to-toe so blood flow builds
// progressively (warm-up) or winds down progressively (cool-down) across the full body.
export const WARM_UP_EXERCISES: string[] = [
  'Neck rolls — 15s each direction',
  'Arm circles — 20s',
  'Shoulder shrugs — 15s',
  'Torso twists — 20s',
  'Hip circles — 20s each direction',
  'Leg swings — 20s each leg',
  'Bodyweight squats — 10 reps',
  'High knees — 30s',
  'Jumping jacks — 30s',
];

export const COOL_DOWN_EXERCISES: string[] = [
  'Standing quad stretch — 30s each leg',
  'Hamstring stretch — 30s each leg',
  'Calf stretch — 20s each leg',
  "Standing figure-4 hip stretch — 20s each side",
  'Shoulder stretch — 20s each side',
  'Triceps stretch — 20s each side',
  'Cat-cow — 30s',
  "Child's pose — 30s",
  'Seated forward fold — 30s',
  'Deep breathing — 1 min',
];
