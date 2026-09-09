#!/usr/bin/env node
/**
 * Pushes the normalized exercise catalog (scripts/output/exercises_normalized.json, produced by
 * fetch_exercise_data.py) into Firestore's public `exercises` collection, plus the hand-authored
 * starter `programs` from db/schema.ts's v30 migration (kept in sync manually — see STARTER_PROGRAMS
 * below, mirrored from db/schema.ts).
 *
 * Defaults to --dry-run: prints exactly what WOULD be written (counts + a few sample docs) without
 * touching Firestore. Pass --live to actually write. This never runs live by accident.
 *
 * Usage:
 *   node scripts/seed_firestore.js                # dry run (default)
 *   node scripts/seed_firestore.js --live          # actually writes to Firestore
 *   node scripts/seed_firestore.js --live --service-account ./key.json
 *
 * Auth: uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS env var, or
 * `gcloud auth application-default login`) unless --service-account points at a key file.
 * This is Admin SDK access — it bypasses firestore.rules entirely, same as any Cloud Function.
 */

const fs = require('fs');
const path = require('path');

const NORMALIZED_PATH = path.join(__dirname, 'output', 'exercises_normalized.json');

// Mirrors db/schema.ts's v30 STARTER_PROGRAMS exactly — if you change one, change both, since
// SQLite gets these at first-install migration time and Firestore gets them here for later
// installs / catalog refreshes to pull down. Not deduplicated across the two files because
// migrations must stay self-contained and never depend on a network fetch at run time.
const STARTER_PROGRAMS = [
  {
    key: 'full-body-strength-4wk',
    title: 'Full Body Strength',
    description: 'A 3-day push/pull/legs split for building overall strength with barbell and machine work.',
    goal: 'strength',
    equipment: 'full-gym',
    weeks: 4,
    days: [
      {
        key: 'day-1-push',
        title: 'Day 1 — Push',
        exercises: [
          { exerciseKey: 'bench-press', sets: 3, reps: 10 },
          { exerciseKey: 'shoulder-press-dumbbells', sets: 3, reps: 10 },
          { exerciseKey: 'tricep-pushdown-on-cable', sets: 3, reps: 12 },
        ],
      },
      {
        key: 'day-2-pull',
        title: 'Day 2 — Pull',
        exercises: [
          { exerciseKey: 'deadlifts', sets: 3, reps: 8 },
          { exerciseKey: 'bent-over-rowing', sets: 3, reps: 10 },
          { exerciseKey: 'pull-ups', sets: 3, reps: 8 },
          { exerciseKey: 'seated-row-machine', sets: 3, reps: 12 },
        ],
      },
      {
        key: 'day-3-legs',
        title: 'Day 3 — Legs & Core',
        exercises: [
          { exerciseKey: 'box-squat', sets: 3, reps: 10 },
          { exerciseKey: 'lunges', sets: 3, reps: 12, note: 'each leg' },
          { exerciseKey: 'leg-press', sets: 3, reps: 12 },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
        ],
      },
    ],
  },
  {
    key: 'beginner-bodyweight-3wk',
    title: 'Beginner Bodyweight',
    description: 'A 2-day, no-equipment routine to build a consistent training habit.',
    goal: 'general',
    equipment: 'none',
    weeks: 3,
    days: [
      {
        key: 'day-1-upper',
        title: 'Day 1 — Upper & Core',
        exercises: [
          { exerciseKey: 'push-up', sets: 3, reps: 10 },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
          { exerciseKey: 'crunches', sets: 3, reps: 15 },
        ],
      },
      {
        key: 'day-2-lower',
        title: 'Day 2 — Lower Body',
        exercises: [
          { exerciseKey: 'slow-squat', sets: 3, reps: 12 },
          { exerciseKey: 'lunges', sets: 3, reps: 12, note: 'each leg' },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
        ],
      },
    ],
  },
  // Mirrors db/schema.ts's v31 MORE_PROGRAMS exactly.
  {
    key: 'fat-loss-circuit-4wk',
    title: 'Fat Loss Circuit',
    description: 'No-equipment, high-rep circuits for calorie burn — 3 days a week.',
    goal: 'weight-loss',
    equipment: 'none',
    weeks: 4,
    days: [
      {
        key: 'day-1-circuit-a',
        title: 'Day 1 — Circuit A',
        exercises: [
          { exerciseKey: 'jumping-jacks', sets: 3, reps: 30 },
          { exerciseKey: 'push-up', sets: 3, reps: 12 },
          { exerciseKey: 'squat-jumps', sets: 3, reps: 15 },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
        ],
      },
      {
        key: 'day-2-circuit-b',
        title: 'Day 2 — Circuit B',
        exercises: [
          { exerciseKey: 'burpees', sets: 3, reps: 10 },
          { exerciseKey: 'mountain-climbers', sets: 3, reps: 20 },
          { exerciseKey: 'lunges', sets: 3, reps: 12, note: 'each leg' },
          { exerciseKey: 'bicycle-crunches', sets: 3, reps: 20 },
        ],
      },
      {
        key: 'day-3-circuit-c',
        title: 'Day 3 — Circuit C',
        exercises: [
          { exerciseKey: 'high-knees', sets: 3, reps: 30 },
          { exerciseKey: 'crunches', sets: 3, reps: 20 },
          { exerciseKey: 'slow-squat', sets: 3, reps: 15 },
          { exerciseKey: 'russian-twist', sets: 3, reps: 20 },
        ],
      },
    ],
  },
  {
    key: 'cardio-core-shred-3wk',
    title: 'Cardio & Core Shred',
    description: 'Two no-equipment cardio and core sessions a week — short, intense, and easy to fit in.',
    goal: 'weight-loss',
    equipment: 'none',
    weeks: 3,
    days: [
      {
        key: 'day-1-cardio-blast',
        title: 'Day 1 — Cardio Blast',
        exercises: [
          { exerciseKey: 'jumping-jacks', sets: 3, reps: 30 },
          { exerciseKey: 'high-knees', sets: 3, reps: 30 },
          { exerciseKey: 'burpees', sets: 3, reps: 10 },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
        ],
      },
      {
        key: 'day-2-core-conditioning',
        title: 'Day 2 — Core & Conditioning',
        exercises: [
          { exerciseKey: 'mountain-climbers', sets: 3, reps: 20 },
          { exerciseKey: 'bicycle-crunches', sets: 3, reps: 20 },
          { exerciseKey: 'russian-twist', sets: 3, reps: 20 },
          { exerciseKey: 'squat-jumps', sets: 3, reps: 15 },
        ],
      },
    ],
  },
  {
    key: 'muscle-building-upper-lower-6wk',
    title: 'Muscle Building — Upper/Lower Split',
    description: 'A 4-day upper/lower split for building size and strength with barbell and machine work.',
    goal: 'muscle-building',
    equipment: 'full-gym',
    weeks: 6,
    days: [
      {
        key: 'day-1-upper-push',
        title: 'Day 1 — Upper (Push)',
        exercises: [
          { exerciseKey: 'bench-press', sets: 4, reps: 8 },
          { exerciseKey: 'incline-bench-press-barbell', sets: 3, reps: 10 },
          { exerciseKey: 'shoulder-press-dumbbells', sets: 3, reps: 10 },
          { exerciseKey: 'dips', sets: 3, reps: 10 },
        ],
      },
      {
        key: 'day-2-lower-quad',
        title: 'Day 2 — Lower (Quad Focus)',
        exercises: [
          { exerciseKey: 'front-squats', sets: 4, reps: 8 },
          { exerciseKey: 'leg-press', sets: 3, reps: 10 },
          { exerciseKey: 'lunges', sets: 3, reps: 10, note: 'each leg' },
          { exerciseKey: 'hip-thrust', sets: 3, reps: 12 },
        ],
      },
      {
        key: 'day-3-upper-pull',
        title: 'Day 3 — Upper (Pull)',
        exercises: [
          { exerciseKey: 'deadlifts', sets: 4, reps: 6 },
          { exerciseKey: 'bent-over-rowing', sets: 3, reps: 10 },
          { exerciseKey: 'pull-ups', sets: 3, reps: 8 },
          { exerciseKey: 'hammer-curls', sets: 3, reps: 12 },
        ],
      },
      {
        key: 'day-4-lower-hamstring',
        title: 'Day 4 — Lower (Hamstring & Glute Focus)',
        exercises: [
          { exerciseKey: 'romanian-deadlift', sets: 4, reps: 8 },
          { exerciseKey: 'leg-press', sets: 3, reps: 12 },
          { exerciseKey: 'hip-thrust', sets: 3, reps: 12 },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
        ],
      },
    ],
  },
  {
    key: 'lean-bulk-ppl-6wk',
    title: 'Lean Bulk Push Pull Legs',
    description: 'A 3-day push/pull/legs split with higher volume, built for a calorie-surplus muscle-gain phase.',
    goal: 'muscle-building',
    equipment: 'full-gym',
    weeks: 6,
    days: [
      {
        key: 'day-1-push',
        title: 'Day 1 — Push',
        exercises: [
          { exerciseKey: 'bench-press', sets: 4, reps: 8 },
          { exerciseKey: 'incline-bench-press-barbell', sets: 3, reps: 10 },
          { exerciseKey: 'shoulder-press-dumbbells', sets: 3, reps: 10 },
          { exerciseKey: 'dips', sets: 3, reps: 12 },
        ],
      },
      {
        key: 'day-2-pull',
        title: 'Day 2 — Pull',
        exercises: [
          { exerciseKey: 'deadlifts', sets: 4, reps: 6 },
          { exerciseKey: 'bent-over-rowing', sets: 4, reps: 10 },
          { exerciseKey: 'pull-ups', sets: 3, reps: 8 },
          { exerciseKey: 'hammer-curls', sets: 3, reps: 12 },
        ],
      },
      {
        key: 'day-3-legs',
        title: 'Day 3 — Legs',
        exercises: [
          { exerciseKey: 'front-squats', sets: 4, reps: 8 },
          { exerciseKey: 'romanian-deadlift', sets: 3, reps: 10 },
          { exerciseKey: 'leg-press', sets: 3, reps: 12 },
          { exerciseKey: 'hip-thrust', sets: 3, reps: 12 },
        ],
      },
    ],
  },
  // Mirrors db/schema.ts's v32 MORE_PROGRAMS_V32 exactly.
  {
    key: '20min-fat-burn-4wk',
    title: '20-Minute Fat Burn',
    description: 'A short, no-equipment cardio session for days when you only have 20 minutes.',
    goal: 'weight-loss',
    equipment: 'none',
    weeks: 4,
    days: [
      {
        key: 'day-1',
        title: 'Day 1',
        exercises: [
          { exerciseKey: 'burpees', sets: 3, reps: 10 },
          { exerciseKey: 'high-knees', sets: 3, reps: 30 },
          { exerciseKey: 'squat-jumps', sets: 3, reps: 15 },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
        ],
      },
      {
        key: 'day-2',
        title: 'Day 2',
        exercises: [
          { exerciseKey: 'jumping-jacks', sets: 3, reps: 30 },
          { exerciseKey: 'mountain-climbers', sets: 3, reps: 20 },
          { exerciseKey: 'jump-rope-basic-jumps', sets: 3, reps: 30 },
          { exerciseKey: 'bicycle-crunches', sets: 3, reps: 20 },
        ],
      },
    ],
  },
  {
    key: 'beginner-muscle-building-dumbbell-6wk',
    title: 'Beginner Muscle Building',
    description: 'A dumbbell-only full-body A/B split — no full gym needed to start building muscle.',
    goal: 'muscle-building',
    equipment: 'dumbbells',
    weeks: 6,
    days: [
      {
        key: 'day-1-full-body-a',
        title: 'Day 1 — Full Body A',
        exercises: [
          { exerciseKey: 'dumbbell-floor-press', sets: 3, reps: 10 },
          { exerciseKey: 'dumbbell-goblet-squat', sets: 3, reps: 12 },
          { exerciseKey: 'bent-over-dumbbell-rows', sets: 3, reps: 10 },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
        ],
      },
      {
        key: 'day-2-full-body-b',
        title: 'Day 2 — Full Body B',
        exercises: [
          { exerciseKey: 'single-arm-dumbbell-shoulder-press', sets: 3, reps: 10, note: 'each arm' },
          { exerciseKey: 'step-ups', sets: 3, reps: 12, note: 'each leg' },
          { exerciseKey: 'dumbbell-curl', sets: 3, reps: 12 },
          { exerciseKey: 'crunches', sets: 3, reps: 20 },
        ],
      },
    ],
  },
  // Mirrors db/schema.ts's v34 MORE_PROGRAMS_V34 exactly.
  {
    key: 'core-and-mobility-3wk',
    title: 'Core & Mobility',
    description: 'No-equipment core work paired with mobility stretches — a lighter, general-fitness option.',
    goal: 'general',
    equipment: 'none',
    weeks: 3,
    days: [
      {
        key: 'day-1',
        title: 'Day 1',
        exercises: [
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
          { exerciseKey: 'crunches', sets: 3, reps: 20 },
          { exerciseKey: 'russian-twist', sets: 3, reps: 20 },
          { exerciseKey: 'cat-cow', sets: 2, reps: 1, note: '30s' },
        ],
      },
      {
        key: 'day-2',
        title: 'Day 2',
        exercises: [
          { exerciseKey: 'bicycle-crunches', sets: 3, reps: 20 },
          { exerciseKey: 'hip-circles', sets: 2, reps: 1, note: '20s each direction' },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
          { exerciseKey: 'child-s-pose', sets: 2, reps: 1, note: '30s' },
        ],
      },
    ],
  },
  {
    key: 'advanced-ppl-6wk',
    title: 'Advanced Push Pull Legs',
    description: 'A higher-variety 3-day push/pull/legs split for lifters past the beginner stage.',
    goal: 'muscle-building',
    equipment: 'full-gym',
    weeks: 6,
    days: [
      {
        key: 'day-1-push',
        title: 'Day 1 — Push',
        exercises: [
          { exerciseKey: 'bench-press', sets: 4, reps: 6 },
          { exerciseKey: 'incline-bench-press-barbell', sets: 3, reps: 10 },
          { exerciseKey: 'shoulder-press-dumbbells', sets: 3, reps: 10 },
          { exerciseKey: 'dips', sets: 3, reps: 12 },
        ],
      },
      {
        key: 'day-2-pull',
        title: 'Day 2 — Pull',
        exercises: [
          { exerciseKey: 'deadlifts', sets: 4, reps: 5 },
          { exerciseKey: 'bent-over-rowing', sets: 4, reps: 8 },
          { exerciseKey: 'pull-ups', sets: 4, reps: 8 },
          { exerciseKey: 'hammer-curls', sets: 3, reps: 10 },
        ],
      },
      {
        key: 'day-3-legs',
        title: 'Day 3 — Legs',
        exercises: [
          { exerciseKey: 'front-squats', sets: 4, reps: 6 },
          { exerciseKey: 'romanian-deadlift', sets: 4, reps: 8 },
          { exerciseKey: 'leg-press', sets: 3, reps: 12 },
          { exerciseKey: 'hip-thrust', sets: 3, reps: 10 },
          { exerciseKey: 'lunges', sets: 3, reps: 10, note: 'each leg' },
        ],
      },
    ],
  },
  // Mirrors db/schema.ts's v35 MORE_PROGRAMS_V35 exactly.
  {
    key: 'calisthenics-foundations-6wk',
    title: 'Calisthenics Foundations',
    description: 'A bodyweight-only push/pull/legs split — no equipment needed, just your own bodyweight.',
    goal: 'muscle-building',
    equipment: 'none',
    weeks: 6,
    days: [
      {
        key: 'day-1-push',
        title: 'Day 1 — Push',
        exercises: [
          { exerciseKey: 'push-up', sets: 3, reps: 12 },
          { exerciseKey: 'diamond-push-ups', sets: 3, reps: 8 },
          { exerciseKey: 'dips', sets: 3, reps: 10 },
          { exerciseKey: 'plank', sets: 3, reps: 1, note: '30s hold' },
        ],
      },
      {
        key: 'day-2-pull',
        title: 'Day 2 — Pull',
        exercises: [
          { exerciseKey: 'pull-ups', sets: 3, reps: 6 },
          { exerciseKey: 'chin-up', sets: 3, reps: 6 },
          { exerciseKey: 'hanging-leg-raises', sets: 3, reps: 10 },
          { exerciseKey: 'bicycle-crunches', sets: 3, reps: 20 },
        ],
      },
      {
        key: 'day-3-legs',
        title: 'Day 3 — Legs',
        exercises: [
          { exerciseKey: 'slow-squat', sets: 3, reps: 15 },
          { exerciseKey: 'pistol-squat', sets: 3, reps: 5, note: 'each leg, assisted if needed' },
          { exerciseKey: 'lunges', sets: 3, reps: 12, note: 'each leg' },
          { exerciseKey: 'glute-bridge', sets: 3, reps: 15 },
        ],
      },
    ],
  },
  {
    key: 'period-friendly-movement',
    title: 'Period-Friendly Movement',
    description:
      "Gentle, low-intensity movement for days you'd still like to move but full training doesn't feel right. Not medical advice — stop and check with a doctor if pain is severe, worsening, or unusual.",
    goal: 'recovery',
    equipment: 'none',
    weeks: 1,
    days: [
      {
        key: 'day-1',
        title: 'Anytime',
        exercises: [
          { exerciseKey: 'cat-cow', sets: 2, reps: 1, note: '30s' },
          { exerciseKey: 'child-s-pose', sets: 2, reps: 1, note: '30s' },
          { exerciseKey: 'hip-circles', sets: 2, reps: 1, note: '20s each direction' },
          { exerciseKey: 'knee-to-chest-stretch', sets: 2, reps: 1, note: '20s each leg' },
          { exerciseKey: 'glute-bridge', sets: 2, reps: 10, note: 'light' },
        ],
      },
    ],
  },
  {
    key: 'body-pain-relief',
    title: 'Body Pain & Stiffness Relief',
    description:
      "Gentle mobility for everyday stiffness or general aches. Not medical advice — sharp pain, numbness, swelling, or pain that keeps getting worse should be checked by a healthcare professional, not worked through.",
    goal: 'recovery',
    equipment: 'none',
    weeks: 1,
    days: [
      {
        key: 'day-1',
        title: 'Anytime',
        exercises: [
          { exerciseKey: 'cat-cow', sets: 2, reps: 1, note: '30s' },
          { exerciseKey: 'shoulder-shrug', sets: 2, reps: 1, note: '15s' },
          { exerciseKey: 'torso-twist', sets: 2, reps: 1, note: '20s' },
          { exerciseKey: 'hip-circles', sets: 2, reps: 1, note: '20s each direction' },
          { exerciseKey: 'knee-to-chest-stretch', sets: 2, reps: 1, note: '20s each leg' },
          { exerciseKey: 'standing-calf-stretch', sets: 2, reps: 1, note: '20s each leg' },
        ],
      },
    ],
  },
  // Mirrors db/schema.ts's v36 MORE_PROGRAMS_V36 exactly.
  {
    key: 'warm-up-routine',
    title: 'Warm-Up Routine',
    description: 'A quick, head-to-toe warm-up to do before any workout.',
    goal: 'general',
    equipment: 'none',
    weeks: 1,
    days: [
      {
        key: 'day-1',
        title: 'Warm-Up',
        exercises: [
          { exerciseKey: 'shoulder-shrug', sets: 1, reps: 1, note: '15s' },
          { exerciseKey: 'forward-arm-circles', sets: 1, reps: 1, note: '20s' },
          { exerciseKey: 'torso-twist', sets: 1, reps: 1, note: '20s' },
          { exerciseKey: 'hip-circles', sets: 1, reps: 1, note: '20s' },
          { exerciseKey: 'leg-swings-front-back', sets: 1, reps: 1, note: '20s each leg' },
          { exerciseKey: 'jumping-jacks', sets: 1, reps: 30 },
        ],
      },
    ],
  },
  {
    key: 'cool-down-stretching',
    title: 'Cool-Down & Stretching',
    description: 'Static stretches to do after any workout.',
    goal: 'general',
    equipment: 'none',
    weeks: 1,
    days: [
      {
        key: 'day-1',
        title: 'Cool-Down',
        exercises: [
          { exerciseKey: 'quad-stretch', sets: 1, reps: 1, note: '30s each leg' },
          { exerciseKey: 'single-leg-hamstring-stretch', sets: 1, reps: 1, note: '30s each leg' },
          { exerciseKey: 'standing-calf-stretch', sets: 1, reps: 1, note: '20s each leg' },
          { exerciseKey: 'extreme-shoulder-stretch', sets: 1, reps: 1, note: '20s each side' },
          { exerciseKey: 'triceps-stretch-left', sets: 1, reps: 1, note: '20s' },
          { exerciseKey: 'cat-cow', sets: 1, reps: 1, note: '30s' },
          { exerciseKey: 'child-s-pose', sets: 1, reps: 1, note: '30s' },
        ],
      },
    ],
  },
];

// Mirrors db/schema.ts's v31 MEAL_PLANS exactly.
const MEAL_PLANS = [
  {
    key: 'budget-weight-loss-veg',
    title: 'Budget Weight Loss — Veg',
    description: 'Everyday vegetarian staples — dal, roti, rice, curd — at a calorie deficit without needing anything fancy.',
    goal: 'weight-loss',
    budgetTier: 'budget',
    diet: 'veg',
    dailyCaloriesTarget: 1400,
    days: [
      {
        key: 'day-1',
        title: 'Day 1',
        items: [
          { meal: 'breakfast', dishName: 'Idli (2 pieces) + Sambar + Filter Coffee', calories: 258, proteinG: 10, carbsG: 44, fatG: 3 },
          { meal: 'lunch', dishName: 'Dal Tadka + Steamed Rice + Bhindi Masala + Plain Curd', calories: 590, proteinG: 22, carbsG: 82, fatG: 16 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas)', calories: 40, proteinG: 3, carbsG: 4, fatG: 1 },
          { meal: 'dinner', dishName: 'Moong Dal + Roti (2 pieces) + Mixed Vegetable Curry', calories: 472, proteinG: 20, carbsG: 61, fatG: 15 },
        ],
      },
      {
        key: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Plain Dosa (2 pieces) + Coconut Chutney + Filter Coffee', calories: 332, proteinG: 8, carbsG: 51, fatG: 8 },
          { meal: 'lunch', dishName: 'Sambar + Steamed Rice + Aloo Gobi + Plain Curd', calories: 580, proteinG: 19, carbsG: 85, fatG: 16 },
          { meal: 'snack', dishName: 'Coconut Water', calories: 45, proteinG: 0.5, carbsG: 9, fatG: 0.2 },
          { meal: 'dinner', dishName: 'Rasam + Roti (2 pieces) + Chana Masala', calories: 412, proteinG: 15, carbsG: 55, fatG: 12 },
        ],
      },
      {
        key: 'day-3',
        title: 'Day 3',
        items: [
          { meal: 'breakfast', dishName: 'Upma + Filter Coffee', calories: 255, proteinG: 6, carbsG: 38, fatG: 9 },
          { meal: 'lunch', dishName: 'Moong Dal + Steamed Rice + Bhindi Masala + Plain Curd', calories: 570, proteinG: 24, carbsG: 79, fatG: 15 },
          { meal: 'snack', dishName: 'Coconut Water', calories: 45, proteinG: 0.5, carbsG: 9, fatG: 0.2 },
          { meal: 'dinner', dishName: 'Sambar + Roti (2 pieces) + Aloo Matar', calories: 442, proteinG: 15, carbsG: 55, fatG: 12 },
        ],
      },
    ],
  },
  {
    key: 'budget-weight-loss-nonveg',
    title: 'Budget Weight Loss — Non-Veg',
    description: 'Lean protein (egg, fish, chicken) with everyday staples, at a calorie deficit.',
    goal: 'weight-loss',
    budgetTier: 'budget',
    diet: 'non-veg',
    dailyCaloriesTarget: 1500,
    days: [
      {
        key: 'day-1',
        title: 'Day 1',
        items: [
          { meal: 'breakfast', dishName: 'Egg Bhurji (2 eggs) + Roti + Filter Coffee', calories: 351, proteinG: 18, carbsG: 25, fatG: 21 },
          { meal: 'lunch', dishName: 'Fish Curry + Steamed Rice + Rasam', calories: 480, proteinG: 24, carbsG: 54, fatG: 14 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas)', calories: 40, proteinG: 3, carbsG: 4, fatG: 1 },
          { meal: 'dinner', dishName: 'Chicken Curry + Roti (2 pieces)', calories: 422, proteinG: 28, carbsG: 22, fatG: 19 },
        ],
      },
      {
        key: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Egg Curry (2 eggs) + Rumali Roti + Filter Coffee', calories: 400, proteinG: 19, carbsG: 31, fatG: 22 },
          { meal: 'lunch', dishName: 'Prawn Curry + Steamed Rice + Rasam', calories: 500, proteinG: 26, carbsG: 63, fatG: 15 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas)', calories: 40, proteinG: 3, carbsG: 4, fatG: 1 },
          { meal: 'dinner', dishName: 'Tandoori Chicken + Roti (2 pieces)', calories: 362, proteinG: 34, carbsG: 33, fatG: 11 },
        ],
      },
    ],
  },
  {
    key: 'muscle-building-veg',
    title: 'Muscle Building — Veg',
    description: 'High-protein vegetarian meals (paneer, dal, curd, milk) at a calorie surplus for muscle gain.',
    goal: 'muscle-building',
    budgetTier: 'moderate',
    diet: 'veg',
    dailyCaloriesTarget: 2800,
    days: [
      {
        key: 'day-1',
        title: 'Day 1',
        items: [
          { meal: 'breakfast', dishName: 'Paneer Paratha (2 pieces) + Plain Curd + Badam Milk', calories: 760, proteinG: 28, carbsG: 72, fatG: 34 },
          { meal: 'lunch', dishName: 'Rajma + Steamed Rice (1.5 cups) + Palak Paneer + Raita', calories: 860, proteinG: 36, carbsG: 92, fatG: 34 },
          { meal: 'snack', dishName: 'Sweet Lassi + Besan Ladoo', calories: 400, proteinG: 9, carbsG: 50, fatG: 17 },
          { meal: 'dinner', dishName: 'Dal Makhani + Roti (3 pieces) + Matar Paneer', calories: 773, proteinG: 32, carbsG: 74, fatG: 38 },
        ],
      },
      {
        key: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Pesarattu + Peanut Chutney + Badam Milk', calories: 430, proteinG: 16, carbsG: 50, fatG: 18 },
          { meal: 'lunch', dishName: 'Chana Masala + Steamed Rice (1.5 cups) + Shahi Paneer + Raita', calories: 920, proteinG: 33, carbsG: 120, fatG: 35 },
          { meal: 'snack', dishName: 'Kheer + Coconut Ladoo', calories: 360, proteinG: 8, carbsG: 46, fatG: 16 },
          { meal: 'dinner', dishName: 'Rajma + Roti (3 pieces) + Palak Paneer', calories: 683, proteinG: 32, carbsG: 92, fatG: 24 },
        ],
      },
    ],
  },
  {
    key: 'muscle-building-nonveg',
    title: 'Muscle Building — Non-Veg',
    description: 'High-protein meals built around egg and chicken at a calorie surplus for muscle gain.',
    goal: 'muscle-building',
    budgetTier: 'moderate',
    diet: 'non-veg',
    dailyCaloriesTarget: 2900,
    days: [
      {
        key: 'day-1',
        title: 'Day 1',
        items: [
          { meal: 'breakfast', dishName: 'Egg Curry (2 eggs) + Paratha (2 pieces) + Badam Milk', calories: 712, proteinG: 30, carbsG: 66, fatG: 32 },
          { meal: 'lunch', dishName: 'Chicken Tikka Masala + Steamed Rice (1.5 cups) + Dal Tadka + Plain Curd', calories: 880, proteinG: 46, carbsG: 82, fatG: 33 },
          { meal: 'snack', dishName: 'Sweet Lassi + Banana Chips', calories: 480, proteinG: 7, carbsG: 60, fatG: 21 },
          { meal: 'dinner', dishName: 'Butter Chicken + Naan (2 pieces)', calories: 874, proteinG: 42, carbsG: 55, fatG: 42 },
        ],
      },
      {
        key: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Chicken Kebab + Naan + Badam Milk', calories: 702, proteinG: 38, carbsG: 73, fatG: 28 },
          { meal: 'lunch', dishName: 'Mutton Rogan Josh + Steamed Rice (1.5 cups) + Dal Tadka', calories: 790, proteinG: 40, carbsG: 96, fatG: 29 },
          { meal: 'snack', dishName: 'Sweet Lassi + Peda', calories: 310, proteinG: 8, carbsG: 40, fatG: 12 },
          { meal: 'dinner', dishName: 'Chicken Chettinad + Roti (2 pieces)', calories: 442, proteinG: 30, carbsG: 38, fatG: 21 },
        ],
      },
    ],
  },
  // Mirrors db/schema.ts's v32 MORE_MEAL_PLANS_V32 exactly.
  {
    key: 'balanced-maintenance-veg',
    title: 'Balanced Maintenance — Veg',
    description: 'Everyday vegetarian meals sized to maintain your current weight, not lose or gain.',
    goal: 'general',
    budgetTier: 'budget',
    diet: 'veg',
    dailyCaloriesTarget: 1900,
    days: [
      {
        key: 'day-1',
        title: 'Day 1',
        items: [
          { meal: 'breakfast', dishName: 'Masala Dosa + Filter Coffee', calories: 310, proteinG: 7, carbsG: 48, fatG: 10 },
          { meal: 'lunch', dishName: 'Dal Tadka + Steamed Rice (1.5 cups) + Aloo Matar + Plain Curd', calories: 730, proteinG: 24, carbsG: 96, fatG: 21 },
          { meal: 'snack', dishName: 'Sweet Lassi', calories: 220, proteinG: 6, carbsG: 30, fatG: 8 },
          { meal: 'dinner', dishName: 'Sambar + Roti (3 pieces) + Mixed Vegetable Curry', calories: 523, proteinG: 14, carbsG: 59, fatG: 20 },
        ],
      },
      {
        key: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Idli (2 pieces) + Sambar + Filter Coffee', calories: 258, proteinG: 10, carbsG: 44, fatG: 3 },
          { meal: 'lunch', dishName: 'Sambar + Steamed Rice + Aloo Gobi + Plain Curd', calories: 580, proteinG: 19, carbsG: 85, fatG: 16 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas) + Dhokla', calories: 170, proteinG: 7, carbsG: 24, fatG: 4 },
          { meal: 'dinner', dishName: 'Moong Dal + Roti (2 pieces) + Bhindi Masala', calories: 422, proteinG: 16, carbsG: 47, fatG: 11 },
        ],
      },
    ],
  },
  {
    key: 'balanced-maintenance-nonveg',
    title: 'Balanced Maintenance — Non-Veg',
    description: 'Everyday non-vegetarian meals sized to maintain your current weight.',
    goal: 'general',
    budgetTier: 'budget',
    diet: 'non-veg',
    dailyCaloriesTarget: 1900,
    days: [
      {
        key: 'day-1',
        title: 'Day 1',
        items: [
          { meal: 'breakfast', dishName: 'Egg Bhurji (2 eggs) + Roti + Filter Coffee', calories: 351, proteinG: 18, carbsG: 25, fatG: 21 },
          { meal: 'lunch', dishName: 'Chicken Curry + Steamed Rice (1.5 cups) + Dal Tadka', calories: 730, proteinG: 32, carbsG: 78, fatG: 26 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas) + Murukku', calories: 220, proteinG: 6, carbsG: 22, fatG: 12 },
          { meal: 'dinner', dishName: 'Fish Fry + Roti (2 pieces) + Sambar', calories: 462, proteinG: 26, carbsG: 34, fatG: 22 },
        ],
      },
      {
        key: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Chicken Frankie + Filter Coffee', calories: 380, proteinG: 18, carbsG: 43, fatG: 16 },
          { meal: 'lunch', dishName: 'Fish Curry + Steamed Rice + Sambar', calories: 540, proteinG: 30, carbsG: 69, fatG: 16 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas)', calories: 40, proteinG: 3, carbsG: 4, fatG: 1 },
          { meal: 'dinner', dishName: 'Egg Curry (2 eggs) + Roti (2 pieces)', calories: 402, proteinG: 20, carbsG: 38, fatG: 20 },
        ],
      },
    ],
  },
];

function parseArgs(argv) {
  const live = argv.includes('--live');
  const saIndex = argv.indexOf('--service-account');
  const serviceAccountPath = saIndex !== -1 ? argv[saIndex + 1] : null;
  return { live, serviceAccountPath };
}

function loadNormalizedExercises() {
  if (!fs.existsSync(NORMALIZED_PATH)) {
    console.error(`Missing ${NORMALIZED_PATH} — run scripts/fetch_exercise_data.py first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(NORMALIZED_PATH, 'utf8'));
}

function initFirebaseAdmin(serviceAccountPath) {
  const admin = require('firebase-admin');
  if (serviceAccountPath) {
    admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(serviceAccountPath))) });
  } else {
    try {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } catch (error) {
      console.error(
        'Could not load Application Default Credentials. Either run `gcloud auth application-default login`,\n' +
          'set GOOGLE_APPLICATION_CREDENTIALS to a service account key path, or pass --service-account <path>.'
      );
      throw error;
    }
  }
  return admin;
}

async function main() {
  const { live, serviceAccountPath } = parseArgs(process.argv.slice(2));
  const exercises = loadNormalizedExercises();

  console.log(`Loaded ${exercises.length} normalized exercises from ${NORMALIZED_PATH}`);
  console.log(`Loaded ${STARTER_PROGRAMS.length} programs (hand-authored, mirrored from db/schema.ts)`);
  console.log(`Loaded ${MEAL_PLANS.length} meal plans (hand-authored, mirrored from db/schema.ts)`);

  if (!live) {
    console.log('\n--- DRY RUN (no writes will be made; pass --live to actually seed Firestore) ---\n');
    console.log('Sample exercise doc (exercises/<key>):');
    console.log(JSON.stringify(toExerciseDoc(exercises[0]), null, 2));
    console.log('\nSample program doc (programs/<key>):');
    console.log(JSON.stringify(toProgramDoc(STARTER_PROGRAMS[0]), null, 2));
    console.log('\nSample meal plan doc (mealPlans/<key>):');
    console.log(JSON.stringify(toMealPlanDoc(MEAL_PLANS[0]), null, 2));
    console.log(
      `\nWould write ${exercises.length} exercise docs, ${STARTER_PROGRAMS.length} program docs, and ${MEAL_PLANS.length} meal plan docs.`
    );
    return;
  }

  const admin = initFirebaseAdmin(serviceAccountPath);
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  console.log(`\nWriting to Firestore project: ${admin.app().options.projectId || '(default)'}`);
  console.log('LIVE — this will overwrite existing exercises/programs/mealPlans docs with matching keys.\n');

  let batch = db.batch();
  let opsInBatch = 0;
  const commitIfFull = async () => {
    if (opsInBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  };

  for (const exercise of exercises) {
    batch.set(db.collection('exercises').doc(exercise.key), { ...toExerciseDoc(exercise), updatedAt: now });
    opsInBatch += 1;
    await commitIfFull();
  }
  for (const program of STARTER_PROGRAMS) {
    batch.set(db.collection('programs').doc(program.key), { ...toProgramDoc(program), updatedAt: now });
    opsInBatch += 1;
    await commitIfFull();
  }
  for (const plan of MEAL_PLANS) {
    batch.set(db.collection('mealPlans').doc(plan.key), { ...toMealPlanDoc(plan), updatedAt: now });
    opsInBatch += 1;
    await commitIfFull();
  }
  if (opsInBatch > 0) await batch.commit();

  console.log(`Done — wrote ${exercises.length} exercises, ${STARTER_PROGRAMS.length} programs, and ${MEAL_PLANS.length} meal plans.`);
}

function toExerciseDoc(exercise) {
  return {
    key: exercise.key,
    name: exercise.name,
    category: exercise.category,
    muscles: exercise.muscles,
    musclesSecondary: exercise.muscles_secondary,
    equipment: exercise.equipment,
    description: exercise.description,
    imageUrl: exercise.image_url || null,
    gifUrl: exercise.gif_url || null,
    videoUrl: exercise.video_url || null,
    source: exercise.source,
    sourceId: exercise.source_id || null,
  };
}

function toProgramDoc(program) {
  return {
    key: program.key,
    title: program.title,
    description: program.description,
    goal: program.goal,
    equipment: program.equipment,
    weeks: program.weeks,
    days: program.days,
    source: 'bundled',
  };
}

function toMealPlanDoc(plan) {
  return {
    key: plan.key,
    title: plan.title,
    description: plan.description,
    goal: plan.goal,
    budgetTier: plan.budgetTier,
    diet: plan.diet,
    dailyCaloriesTarget: plan.dailyCaloriesTarget,
    days: plan.days,
    source: 'bundled',
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
