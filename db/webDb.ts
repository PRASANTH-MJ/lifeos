import Dexie, { type Table } from 'dexie';
import * as Crypto from 'expo-crypto';

/** Same scheme as db/schema.ts's deterministicSyncId — every seed row (built-in categories,
 * starter affirmations, finance categories) gets a sync_id derived from its fixed content
 * rather than a random UUID, so a web install's seed rows converge with the *same* sync_id a
 * native install seeds for "the same" content, instead of the two devices' sync merge creating
 * duplicate categories/affirmations once this account is also used on a phone. */
async function deterministicSyncId(namespace: string, key: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${namespace}:${key}`);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const SEED_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: 'Quit a bad habit', icon: 'close-circle', color: '#FF3B30' },
  { name: 'Art', icon: 'color-palette', color: '#FF2D55' },
  { name: 'Important', icon: 'heart', color: '#FF2D55' },
  { name: 'Meditation', icon: 'body', color: '#AF52DE' },
  { name: 'Study', icon: 'school', color: '#7C4DFF' },
  { name: 'Sports', icon: 'bicycle', color: '#3D8BFF' },
  { name: 'Entertainment', icon: 'game-controller', color: '#00BCD4' },
  { name: 'Pet', icon: 'paw', color: '#26C6DA' },
  { name: 'Social', icon: 'chatbubble', color: '#00BFA5' },
  { name: 'Finance', icon: 'cash', color: '#34C759' },
  { name: 'Health', icon: 'medkit', color: '#34C759' },
  { name: 'Work', icon: 'briefcase', color: '#8BC34A' },
  { name: 'Nutrition', icon: 'nutrition', color: '#F5A623' },
  { name: 'Home', icon: 'home', color: '#FF9500' },
  { name: 'Outdoor', icon: 'trail-sign', color: '#FF7043' },
  { name: 'Other', icon: 'grid', color: '#FF3B30' },
  { name: 'Communication', icon: 'call', color: '#FF6D6D' },
];

const SEED_FINANCE_CATEGORIES: { name: string; type: 'income' | 'expense'; icon: string; color: string; priority: 'must' | 'need' | 'want' }[] = [
  { name: 'Groceries', type: 'expense', icon: 'cart', color: '#34C759', priority: 'need' },
  { name: 'Transport', type: 'expense', icon: 'car', color: '#3D8BFF', priority: 'need' },
  { name: 'Housing', type: 'expense', icon: 'home', color: '#FF9500', priority: 'must' },
  { name: 'Shopping', type: 'expense', icon: 'bag', color: '#FF2D55', priority: 'want' },
  { name: 'Health', type: 'expense', icon: 'medkit', color: '#00BCD4', priority: 'must' },
  { name: 'Entertainment', type: 'expense', icon: 'game-controller', color: '#AF52DE', priority: 'want' },
  { name: 'Other', type: 'expense', icon: 'ellipsis-horizontal', color: '#8E8E93', priority: 'need' },
  { name: 'Salary', type: 'income', icon: 'cash', color: '#34C759', priority: 'need' },
  { name: 'Freelance', type: 'income', icon: 'briefcase', color: '#3D8BFF', priority: 'need' },
  { name: 'Investment', type: 'income', icon: 'trending-up', color: '#F5A623', priority: 'need' },
  { name: 'Other', type: 'income', icon: 'ellipsis-horizontal', color: '#8E8E93', priority: 'need' },
];

const SEED_AFFIRMATIONS: string[] = [
  'I am capable of handling whatever today brings.',
  'Progress, not perfection.',
  'I choose calm over rushing.',
  'My effort today matters, even if I can’t see the result yet.',
  'I am allowed to rest without earning it.',
  'I trust myself to figure it out.',
  'Small steps still move me forward.',
  'I am worthy of the same patience I give others.',
  'This feeling is temporary.',
  'I can do hard things.',
  'I release what I cannot control.',
  'I am proud of how far I’ve come.',
  'My best today doesn’t have to look like my best yesterday.',
  'I am open to good things happening.',
  'I am enough, exactly as I am right now.',
  'Be Good to Yourself',
  'Dream. Believe. Achieve.',
  'I am a magnet for success & happiness!',
  'My dream life is already mine.',
  'Believe in your dreams.',
  'In a world full of roses, be a sunflower.',
  'Be kind to yourself.',
  'Reset, restart, refocus.',
  'Not yesterday, not tomorrow — now.',
  'What if it all works out?',
  'Discipline.',
  'Dream the impossible dream.',
  "It's always been you vs. you.",
  'I attract everything I want.',
];

/**
 * Web-only IndexedDB schema mirroring db/schema.ts's SQLite tables 1:1 (same table names,
 * same columns as plain objects, same indexes/UNIQUE constraints translated to Dexie's index
 * syntax). Native iOS/Android never load this file — see db/StorageProvider.tsx/.web.tsx.
 *
 * SQL CHECK constraints and triggers have no IndexedDB equivalent; those become explicit
 * guard functions and same-transaction application logic in the web hooks that write to the
 * affected tables (see modules/finance/useTransactions.web.ts, useFinanceGoals.web.ts).
 */
export class FlowsyWebDb extends Dexie {
  // Web-only bookkeeping, not present in db/schema.ts.
  migration_status!: Table<{ key: string; state: 'pending' | 'in_progress' | 'done'; perTableCursor: Record<string, number> }, string>;

  habits!: Table<Record<string, unknown>, number>;
  habit_logs!: Table<Record<string, unknown>, number>;
  tasks!: Table<Record<string, unknown>, number>;
  task_completions!: Table<Record<string, unknown>, number>;
  journal_entries!: Table<Record<string, unknown>, number>;
  journal_checkins!: Table<Record<string, unknown>, number>;
  calendar_events!: Table<Record<string, unknown>, number>;
  meditation_logs!: Table<Record<string, unknown>, number>;
  meditation_custom_track!: Table<Record<string, unknown>, number>;
  breathing_logs!: Table<Record<string, unknown>, number>;
  affirmations!: Table<Record<string, unknown>, number>;
  finance_transactions!: Table<Record<string, unknown>, number>;
  food_logs!: Table<Record<string, unknown>, number>;
  mind_training_logs!: Table<Record<string, unknown>, number>;
  workout_preferences!: Table<Record<string, unknown>, number>;
  workout_logs!: Table<Record<string, unknown>, number>;
  categories!: Table<Record<string, unknown>, number>;
  timer_logs!: Table<Record<string, unknown>, number>;
  app_settings!: Table<Record<string, unknown>, number>;
  shopping_items!: Table<Record<string, unknown>, number>;
  finance_budgets!: Table<Record<string, unknown>, number>;
  finance_accounts!: Table<Record<string, unknown>, number>;
  finance_categories!: Table<Record<string, unknown>, number>;
  user_profile!: Table<Record<string, unknown>, number>;
  finance_goals!: Table<Record<string, unknown>, number>;
  finance_goal_contributions!: Table<Record<string, unknown>, number>;
  finance_debts!: Table<Record<string, unknown>, number>;
  finance_debt_payments!: Table<Record<string, unknown>, number>;
  finance_planned_payments!: Table<Record<string, unknown>, number>;
  finance_labels!: Table<Record<string, unknown>, number>;
  finance_transaction_labels!: Table<Record<string, unknown>, [number, number]>;
  finance_budget_plans!: Table<Record<string, unknown>, number>;
  shopping_lists!: Table<Record<string, unknown>, number>;
  module_reminders!: Table<Record<string, unknown>, number>;
  custom_workouts!: Table<Record<string, unknown>, number>;
  sync_tombstones!: Table<{ sync_id: string; table_name: string; deleted_at: string }, string>;
  sync_outbox!: Table<{ id: number; table_name: string; sync_id: string; payload: string; created_at: string }, number>;
  user_details!: Table<Record<string, unknown>, number>;
  exercise_logs!: Table<Record<string, unknown>, number>;
  water_preferences!: Table<Record<string, unknown>, number>;
  water_logs!: Table<Record<string, unknown>, number>;
  exercises!: Table<Record<string, unknown>, number>;
  programs!: Table<Record<string, unknown>, number>;
  program_days!: Table<Record<string, unknown>, number>;
  program_exercises!: Table<Record<string, unknown>, number>;
  routine_progress!: Table<Record<string, unknown>, number>;
  routine_day_logs!: Table<Record<string, unknown>, number>;
  meal_plans!: Table<Record<string, unknown>, number>;
  meal_plan_days!: Table<Record<string, unknown>, number>;
  meal_plan_items!: Table<Record<string, unknown>, number>;
  cycle_preferences!: Table<Record<string, unknown>, number>;
  cycle_logs!: Table<Record<string, unknown>, number>;
  cardio_activities!: Table<Record<string, unknown>, number>;
  cardio_logs!: Table<Record<string, unknown>, number>;
  cardio_favorite_routes!: Table<Record<string, unknown>, number>;
  life_score_snapshots!: Table<Record<string, unknown>, number>;
  body_measurements!: Table<Record<string, unknown>, number>;
  finance_networth_snapshots!: Table<Record<string, unknown>, number>;
  habit_chains!: Table<Record<string, unknown>, number>;
  task_labels!: Table<Record<string, unknown>, number>;
  task_task_labels!: Table<Record<string, unknown>, [number, number]>;
  relationship_people!: Table<Record<string, unknown>, number>;
  relationship_checkins!: Table<Record<string, unknown>, number>;

  constructor() {
    super('lifeos.web.db');

    this.version(1).stores({
      migration_status: '&key',

      habits: '++id, category_id, sync_id',
      habit_logs: '++id, habit_id, sync_id, &[habit_id+date]',
      tasks: '++id, category_id, parent_task_id, sync_id',
      task_completions: '++id, task_id, sync_id, &[task_id+date]',
      journal_entries: '++id, sync_id',
      journal_checkins: '++id, sync_id, &[date+type]',
      calendar_events: '++id, date, sync_id',
      meditation_logs: '++id, completed_at, sync_id',
      meditation_custom_track: '++id',
      breathing_logs: '++id, completed_at, sync_id',
      affirmations: '++id, sync_id',
      finance_transactions: '++id, account_id, category_id, to_account_id, date, sync_id',
      food_logs: '++id, date, sync_id',
      mind_training_logs: '++id, exercise_key, sync_id',
      workout_preferences: '++id',
      workout_logs: '++id, completed_at, sync_id',
      categories: '++id, sync_id',
      timer_logs: '++id, habit_id, completed_at, sync_id',
      app_settings: '++id',
      shopping_items: '++id, list_id, sync_id',
      finance_budgets: '++id',
      finance_accounts: '++id, sync_id',
      finance_categories: '++id, sync_id',
      user_profile: '++id',
      finance_goals: '++id, sync_id',
      finance_goal_contributions: '++id, goal_id',
      finance_debts: '++id, sync_id',
      finance_debt_payments: '++id, debt_id',
      finance_planned_payments: '++id, account_id, category_id, next_date',
      finance_labels: '++id, &name, sync_id',
      finance_transaction_labels: '[transaction_id+label_id], transaction_id, label_id, sync_id',
      finance_budget_plans: '++id, category_id, period',
      shopping_lists: '++id, sync_id',
      module_reminders: '++id, module_key',
      custom_workouts: '++id, sync_id',
      sync_tombstones: 'sync_id, table_name',
      sync_outbox: '++id, table_name, sync_id',
      user_details: '++id',
      exercise_logs: '++id, exercise_key, date, sync_id',
      water_preferences: '++id',
      water_logs: '++id, date, sync_id',
      exercises: '++id, &key, category',
      programs: '++id, &key',
      program_days: '++id, program_key, &[program_key+day_key]',
      program_exercises: '++id, [program_key+day_key]',
      routine_progress: '++id',
      routine_day_logs: '++id, program_key',
      meal_plans: '++id, &key',
      meal_plan_days: '++id, plan_key, &[plan_key+day_key]',
      meal_plan_items: '++id, [plan_key+day_key]',
      cycle_preferences: '++id',
      cycle_logs: '++id, &date, sync_id',
      cardio_activities: '++id, &activity, sync_id',
      cardio_logs: '++id, date, activity, sync_id',
    });

    // v3 — Life Scoreboard daily snapshots (mirrors db/schema.ts's v49 native migration) and the
    // weekly check-in reminder toggle on app_settings (a plain field, not a new Dexie index —
    // app_settings is keyed by id). Joined the sync pipeline in v11 below, which is where sync_id
    // was added to this store's index string.
    this.version(3).stores({
      life_score_snapshots: '++id, &date',
    });

    // v5 — body_measurements (dated weight snapshots, see useBodyMeasurements.web.ts) — synced
    // like cardio_logs/exercise_logs, so it needs the sync_id index for the same reason v2 added
    // it to those 12 tables below.
    this.version(5).stores({
      body_measurements: '++id, &date, sync_id',
    });

    // v6 — finance_networth_snapshots (see useNetWorthHistory.web.ts), derived entirely from
    // finance_accounts/finance_debts, which already sync on their own. Joined the sync pipeline in
    // v11 below, which is where sync_id was added to this store's index string.
    this.version(6).stores({
      finance_networth_snapshots: '++id, &date',
    });

    // v7 — habit_chains (see db/schema.ts's v59 native migration / modules/habits/useHabitChains.ts)
    // — synced like any other real user data, so it needs the sync_id index for the same reason
    // v2 added it to those 12 tables above.
    this.version(7).stores({
      habit_chains: '++id, sync_id',
    });

    // v8 — task_labels/task_task_labels (see db/schema.ts's v60 native migration), mirroring
    // finance_labels/finance_transaction_labels's index shape exactly (composite [task_id+label_id]
    // primary key, plus single-column indexes for each side of the join).
    this.version(8).stores({
      task_labels: '++id, &name, sync_id',
      task_task_labels: '[task_id+label_id], task_id, label_id, sync_id',
    });

    // v9 — cardio_favorite_routes (see db/schema.ts's v62 native migration / modules/cardio/
    // favoriteRoutes.ts). combo_group_id/weather on cardio_logs are plain unindexed columns (same
    // as sport_name/intensity above), so cardio_logs' own index string doesn't change.
    this.version(9).stores({
      cardio_favorite_routes: '++id, activity, sync_id',
    });

    // v10 — relationship_people/relationship_checkins (see db/schema.ts's v64 native migration /
    // modules/relationships). checkins index person_id for the per-person "last check-in" lookup
    // useRelationshipCheckins.web.ts's score computation needs, same shape as task_task_labels'
    // join-column indexes above.
    this.version(10).stores({
      relationship_people: '++id, sync_id',
      relationship_checkins: '++id, person_id, sync_id',
    });

    // v11 — life_score_snapshots/finance_networth_snapshots join the sync pipeline (see
    // db/schema.ts's v66 native migration comment) — same mergeRemoteRecord `.where('sync_id')`
    // requirement as v2/v4's fix above, so both stores need sync_id added to their index string.
    this.version(11).stores({
      life_score_snapshots: '++id, &date, sync_id',
      finance_networth_snapshots: '++id, &date, sync_id',
    });

    // v4 — routine_progress/routine_day_logs join the sync pipeline (see useRoutineProgress.ts);
    // same v2 fix applied to these two: mergeRemoteRecord does `.where('sync_id').equals(...)`
    // regardless of table, which throws a Dexie SchemaError on a non-indexed keyPath.
    this.version(4).stores({
      routine_progress: '++id, sync_id',
      routine_day_logs: '++id, program_key, sync_id',
    });

    // v2 — 12 tables were missing `sync_id` from their index string despite every row carrying
    // one. mergeRemoteRecord (syncEngine.web.ts) does `.where('sync_id').equals(...)` for every
    // incoming record regardless of table, which Dexie throws a SchemaError on on a non-indexed
    // keyPath — so a remote change to any of these 12 tables could never merge into this device
    // at all, silently (onSnapshot/syncIfDue have no surfaced error path for a per-record throw).
    // Only the changed tables need listing; every other table keeps its v1 definition unchanged.
    this.version(2).stores({
      finance_budgets: '++id, sync_id',
      finance_goal_contributions: '++id, goal_id, sync_id',
      finance_debt_payments: '++id, debt_id, sync_id',
      finance_planned_payments: '++id, account_id, category_id, next_date, sync_id',
      finance_budget_plans: '++id, category_id, period, sync_id',
      meditation_custom_track: '++id, sync_id',
      workout_preferences: '++id, sync_id',
      water_preferences: '++id, sync_id',
      cycle_preferences: '++id, sync_id',
      app_settings: '++id, sync_id',
      module_reminders: '++id, module_key, sync_id',
      user_details: '++id, sync_id',
    });

    // Required so a future web schema version bump doesn't stall a second open tab
    // indefinitely — a tab must close its connection on versionchange for the upgrading
    // tab's request to proceed. Registered once here, not per-component, so every tab has
    // it regardless of which screen mounted first.
    this.on('versionchange', () => this.close());

    // Fires exactly once, the very first time this IndexedDB database is created in a given
    // browser — mirrors db/schema.ts's unconditional singleton-row INSERTs (workout_preferences
    // v4, app_settings v7, finance_budgets v9, user_profile v12, cycle_preferences/water_preferences
    // v27/v40, user_details v25), which every native db open guarantees exist. Without this, a
    // brand-new web install (nothing to carry over from the OPFS migration either) would have an
    // empty singleton table, and hooks built on useLiveQuery can't tell "still loading" apart
    // from "resolved, no row" (Dexie .get on a missing key resolves to undefined either way) —
    // their loading flag would never become false. Migrating users are unaffected: the OPFS
    // migration's bulkPut runs afterward and overwrites these same id=1 rows with the real data.
    this.on('populate', async () => {
      const now = new Date().toISOString();
      await this.workout_preferences.put({ id: 1, goal: 'general', equipment: '[]', time_minutes: 30, updated_at: now, sync_id: 'singleton' });
      await this.app_settings.put({ id: 1, time_format: '24h', updated_at: now, sync_id: 'singleton' });
      await this.finance_budgets.put({ id: 1, weekly_budget: null, monthly_budget: null, updated_at: now, sync_id: 'singleton' });
      await this.user_profile.put({
        id: 1, name: null, avatar_uri: null, pin_hash: null, pin_enabled: 0, biometric_enabled: 0, updated_at: now,
        firebase_uid: null, premium: 0, premium_synced_at: null, sync_id: 'singleton',
      });
      await this.user_details.put({
        id: 1, phone_number: null, date_of_birth: null, height_cm: null, weight_kg: null,
        health_goal: null, income_bracket: null, financial_goals: '[]', onboarding_done: 0,
        // Deliberately an epoch timestamp, not `now` — matches db/schema.ts's v25 seed exactly,
        // so the sync engine's last-write-wins merge always prefers a real remote update over
        // this placeholder (see modules/sync/syncEngine.web.ts's mergeRemoteRecord).
        updated_at: '1970-01-01T00:00:00.000Z', sync_id: 'singleton',
      });
      await this.water_preferences.put({ id: 1, goal_ml: 2000, updated_at: now, sync_id: 'singleton' });
      await this.cycle_preferences.put({
        id: 1, tracking_enabled: 0, average_cycle_length: 28, average_period_length: 5,
        shares_cycle_insights_with_partner: 0, updated_at: now, sync_id: 'singleton',
      });

      // Multi-row seed tables (db/schema.ts v5/v10/v3+v12+v13) — unlike the singletons above,
      // these have no self-healing pull-sync path (unlike exercises/programs/meal_plans, which
      // repopulate via useExerciseCatalogSync.web.ts/useMealPlanSync.web.ts), so a fresh web
      // install would otherwise have permanently empty category pickers and an empty
      // affirmations rotation. sync_ids are deterministic (same scheme as db/schema.ts's
      // deterministicSyncId) so these converge with a native device's seed rows for "the same"
      // content instead of duplicating once this account also syncs from a phone.
      await Promise.all(
        SEED_CATEGORIES.map(async (category) => {
          const syncId = await deterministicSyncId('category', category.name);
          await this.categories.put({ name: category.name, icon: category.icon, color: category.color, applies_to: 'both', created_at: now, updated_at: now, sync_id: syncId } as never);
        })
      );
      await Promise.all(
        SEED_FINANCE_CATEGORIES.map(async (category) => {
          const syncId = await deterministicSyncId('finance_category', `${category.name}:${category.type}`);
          await this.finance_categories.put({ name: category.name, type: category.type, icon: category.icon, color: category.color, priority: category.priority, updated_at: now, sync_id: syncId } as never);
        })
      );
      await Promise.all(
        SEED_AFFIRMATIONS.map(async (text, index) => {
          const syncId = await deterministicSyncId('affirmation', text);
          // Matches native's is_custom split: the first 15 (SEED_AFFIRMATIONS proper) are 0,
          // the rest (image-paired affirmations added in later migrations) are 1.
          await this.affirmations.put({ text, is_favorite: 0, is_custom: index < 15 ? 0 : 1, created_at: now, updated_at: now, sync_id: syncId } as never);
        })
      );
    });
  }
}

export const webDb = new FlowsyWebDb();

/** Every table name in db/schema.ts, in the same grouping db/migrateOpfsToIndexedDb.ts needs —
 * a superset of modules/sync/syncSchema.ts's SYNC_TABLES (which deliberately excludes
 * user_profile, and never included sync_tombstones/sync_outbox/the catalog tables, since those
 * are sync bookkeeping or not synced at all — routine_progress/routine_day_logs ARE now synced,
 * see useRoutineProgress.ts). The migration is a device-local carry-over, not a sync operation,
 * so it must be exhaustive regardless. */
export const ALL_WEB_DB_TABLES: string[] = [
  'habits', 'habit_logs', 'tasks', 'task_completions', 'journal_entries', 'journal_checkins',
  'calendar_events', 'meditation_logs', 'meditation_custom_track', 'breathing_logs', 'affirmations',
  'finance_transactions', 'food_logs', 'mind_training_logs', 'workout_preferences', 'workout_logs',
  'categories', 'timer_logs', 'app_settings', 'shopping_items', 'finance_budgets', 'finance_accounts',
  'finance_categories', 'user_profile', 'finance_goals', 'finance_goal_contributions', 'finance_debts',
  'finance_debt_payments', 'finance_planned_payments', 'finance_labels', 'finance_transaction_labels',
  'finance_budget_plans', 'shopping_lists', 'module_reminders', 'custom_workouts', 'sync_tombstones',
  'sync_outbox', 'user_details', 'exercise_logs', 'water_preferences', 'water_logs', 'exercises',
  'programs', 'program_days', 'program_exercises', 'routine_progress', 'routine_day_logs',
  'meal_plans', 'meal_plan_days', 'meal_plan_items', 'cycle_preferences', 'cycle_logs',
  'cardio_activities', 'cardio_logs', 'cardio_favorite_routes', 'body_measurements', 'habit_chains', 'task_labels', 'task_task_labels',
  'relationship_people', 'relationship_checkins', 'life_score_snapshots', 'finance_networth_snapshots',
];
