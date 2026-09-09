import type { Ionicons } from '@expo/vector-icons';

export type WorkoutGoal = 'general' | 'strength' | 'cardio' | 'flexibility';
export type Equipment = 'none' | 'dumbbells' | 'full-gym';

export type Workout = {
  key: string;
  title: string;
  goal: WorkoutGoal;
  equipment: Equipment;
  minutes: number;
  exercises: string[];
  /** Parallel to `exercises` by index — exercises sharing the same (non-null) group number are a
   * superset/circuit, done back-to-back before resting. Undefined for the built-in WORKOUTS
   * catalog (which has no notion of grouping); only ever populated for custom workouts. */
  exerciseGroups?: (number | null)[];
};

/** One exercise as entered in the workout builder — `supersetGroup` is null for a standalone
 * exercise, or a shared number for 2+ consecutive exercises meant to be done back-to-back as a
 * superset/circuit before resting (see app/(tabs)/workout/new.tsx's "Group with next" toggle).
 * This is the shape `custom_workouts.exercises` is serialized as; useCustomWorkouts(.web).ts also
 * accept the legacy plain `string[]` shape when reading an older row. */
export type CustomWorkoutExercise = { text: string; supersetGroup: number | null };

export type WorkoutPreferences = {
  goal: WorkoutGoal;
  equipment: Equipment[];
  timeMinutes: number;
};

export const GOALS: WorkoutGoal[] = ['general', 'strength', 'cardio', 'flexibility'];
export const EQUIPMENT_OPTIONS: Equipment[] = ['none', 'dumbbells', 'full-gym'];
export const TIME_OPTIONS = [15, 20, 30, 45, 60];

export function goalLabel(goal: WorkoutGoal): string {
  return goal.charAt(0).toUpperCase() + goal.slice(1);
}

export const WORKOUT_GOAL_ICON: Record<WorkoutGoal, keyof typeof Ionicons.glyphMap> = {
  general: 'fitness',
  strength: 'barbell',
  cardio: 'walk',
  flexibility: 'body',
};

export function equipmentLabel(equipment: Equipment): string {
  return { none: 'No equipment', dumbbells: 'Dumbbells', 'full-gym': 'Full gym' }[equipment];
}

export const WORKOUTS: Workout[] = [
  {
    key: 'bodyweight-quick',
    title: 'Quick Bodyweight Circuit',
    goal: 'general',
    equipment: 'none',
    minutes: 15,
    exercises: ['Jumping jacks — 30s', 'Push-ups — 12 reps', 'Bodyweight squats — 15 reps', 'Plank — 30s', 'Repeat the circuit twice'],
  },
  {
    key: 'full-body-strength',
    title: 'Full-Body Strength',
    goal: 'strength',
    equipment: 'dumbbells',
    minutes: 30,
    exercises: ['Dumbbell squats — 3x10', 'Dumbbell rows — 3x10', 'Overhead press — 3x10', 'Lunges — 3x10 each leg', 'Plank — 3x30s'],
  },
  {
    key: 'gym-strength-45',
    title: 'Gym Strength Session',
    goal: 'strength',
    equipment: 'full-gym',
    minutes: 45,
    exercises: ['Barbell squats — 4x8', 'Bench press — 4x8', 'Deadlifts — 3x6', 'Lat pulldown — 3x10', 'Leg press — 3x10'],
  },
  {
    key: 'cardio-hiit-20',
    title: 'HIIT Cardio Blast',
    goal: 'cardio',
    equipment: 'none',
    minutes: 20,
    exercises: ['Burpees — 10 reps', 'High knees — 30s', 'Mountain climbers — 30s', 'Rest — 30s', 'Repeat the circuit 4 times'],
  },
  {
    key: 'cardio-run',
    title: 'Steady-State Run',
    goal: 'cardio',
    equipment: 'none',
    minutes: 30,
    exercises: ['Warm-up walk — 5 min', 'Jog at a moderate pace — 20 min', 'Cool-down walk — 5 min'],
  },
  {
    key: 'dumbbell-cardio',
    title: 'Dumbbell Cardio Circuit',
    goal: 'cardio',
    equipment: 'dumbbells',
    minutes: 25,
    exercises: ['Dumbbell thrusters — 15 reps', 'Renegade rows — 10 each side', 'Dumbbell swings — 20 reps', 'Rest — 1 min', 'Repeat 3 times'],
  },
  {
    key: 'flexibility-morning',
    title: 'Morning Mobility Flow',
    goal: 'flexibility',
    equipment: 'none',
    minutes: 15,
    exercises: ['Cat-cow — 10 reps', 'Downward dog hold — 30s', 'Hip flexor stretch — 30s each side', 'Shoulder rolls — 10 reps', 'Forward fold — 30s'],
  },
  {
    key: 'flexibility-deep',
    title: 'Deep Stretch Session',
    goal: 'flexibility',
    equipment: 'none',
    minutes: 30,
    exercises: ['Full-body dynamic stretch — 10 min', 'Static stretching, all major muscle groups — 15 min', 'Breathing cooldown — 5 min'],
  },
  {
    key: 'full-body-stretch',
    title: 'Full Body Stretch',
    goal: 'flexibility',
    equipment: 'none',
    minutes: 12,
    exercises: [
      'Neck stretch — 20s each side',
      'Shoulder & chest stretch — 20s',
      'Overhead triceps stretch — 20s each arm',
      'Standing side bend — 20s each side',
      'Standing forward fold — 30s',
      'Standing quad stretch — 30s each leg',
      'Standing figure-4 hip stretch — 20s each side',
      'Butterfly stretch — 30s',
      'Seated hamstring stretch — 30s each leg',
      'Calf stretch — 20s each leg',
      "Child's pose — 30s",
      'Cat-cow — 30s',
    ],
  },
  {
    key: 'gym-general-30',
    title: 'Balanced Gym Session',
    goal: 'general',
    equipment: 'full-gym',
    minutes: 30,
    exercises: ['Treadmill warm-up — 5 min', 'Machine circuit: chest, back, legs — 3x12 each', 'Core finisher — 5 min'],
  },
  {
    key: 'dumbbell-general-20',
    title: 'Quick Dumbbell Mix',
    goal: 'general',
    equipment: 'dumbbells',
    minutes: 20,
    exercises: ['Goblet squats — 3x12', 'Dumbbell rows — 3x12', 'Bicep curls — 3x12', 'Tricep extensions — 3x12'],
  },
];

export function findWorkout(key: string): Workout | undefined {
  return WORKOUTS.find((workout) => workout.key === key);
}
