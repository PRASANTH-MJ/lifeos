export type SyncForeignKey = { column: string; referencesTable: string };

/** How far back from the persisted sync cursor a pull query's `where('updatedAt', '>=', ...)`
 * bound is deliberately widened — a real bug, not a hypothetical: the cursor and every record's
 * `updatedAt` are both stamped from each DEVICE'S OWN clock (there's no Firestore server
 * timestamp in the loop), so a write made on a device whose clock reads even a few minutes
 * behind another device's already-advanced cursor would otherwise fail the `>=` comparison and
 * never be pulled down — permanently and silently, since the cursor only ever advances forward.
 * Re-processing a handful of already-merged records inside this window is harmless: mergeBatch's
 * last-write-wins check (`existingUpdatedAt >= updatedAt`) already makes re-merging idempotent. */
export const SYNC_CURSOR_SAFETY_MARGIN_MS = 15 * 60 * 1000;

/** Widens a persisted sync cursor backward by SYNC_CURSOR_SAFETY_MARGIN_MS before using it as a
 * pull query's lower bound — null (no cursor yet, e.g. a device's first-ever sync) passes through
 * unchanged, since there's nothing to widen and the caller already falls back to an unfiltered
 * full read in that case. */
export function cursorQueryFloor(cursor: string | null): string | null {
  if (!cursor) return cursor;
  const parsed = Date.parse(cursor);
  if (Number.isNaN(parsed)) return cursor;
  return new Date(parsed - SYNC_CURSOR_SAFETY_MARGIN_MS).toISOString();
}

export type SyncTableConfig = {
  table: string;
  foreignKeys?: SyncForeignKey[];
};

/**
 * Every table synced to Firestore, in dependency order (a table only ever lists a foreign key
 * to a table that appears earlier in this array) — an initial pull processes tables in this
 * order so a foreign-key lookup always has something to find. `user_profile` is deliberately
 * excluded: its PIN lock is device-specific and shouldn't follow the account to a new device,
 * and its premium flag already has its own dedicated, Cloud-Function-gated sync path (see
 * modules/premium/usePremium.ts) — folding it into this generic mechanism would just be a
 * redundant, unnecessary second writer of the same field.
 *
 * `routine_progress`/`routine_day_logs` were scaffolded (schema + sync_id columns) well before
 * the program-progress feature (useRoutineProgress.ts) that actually writes to them existed —
 * see that file's doc comment.
 */
export const SYNC_TABLES: SyncTableConfig[] = [
  // user_details/app_settings deliberately come first, ahead of alphabetical/FK-dependency
  // order (both have zero foreignKeys, so nothing else depends on merge order putting them
  // here) — user_details.onboarding_done is what RootNavigation's stackReady gate checks before
  // showing the real app at all (see app/_layout.tsx). On a fresh install signed back into an
  // account with a lot of history, these two used to sit near the very end of this list, so
  // literally every other table (finance, habits, a large shopping list, ...) merged first before
  // the onboarding gate ever cleared — a real device merging hundreds of records one at a time
  // could take long enough that a user staring at a seemingly-stuck onboarding screen would give
  // up and redo onboarding (racing a last-write-wins overwrite of their real historical answers)
  // or reach for Settings' separate Cloud Backup "Restore" as a way to force it, never realizing
  // the normal sync was already working, just slowly and on a table ordered almost last.
  { table: 'user_details' },
  { table: 'app_settings' },
  { table: 'categories' },
  { table: 'finance_accounts' },
  { table: 'finance_categories' },
  { table: 'finance_budgets' },
  { table: 'finance_goals' },
  { table: 'finance_debts' },
  { table: 'finance_labels' },
  { table: 'task_labels' },
  { table: 'shopping_lists' },
  { table: 'habits', foreignKeys: [{ column: 'category_id', referencesTable: 'categories' }] },
  // habit_sync_ids is a JSON array of habit sync_ids, not a single scalar foreign key column — see
  // db/schema.ts's v59 migration comment for why it's stored that way instead of via `foreignKeys`.
  { table: 'habit_chains' },
  {
    table: 'tasks',
    foreignKeys: [
      { column: 'category_id', referencesTable: 'categories' },
      { column: 'parent_task_id', referencesTable: 'tasks' },
      { column: 'blocked_by_task_id', referencesTable: 'tasks' },
    ],
  },
  { table: 'habit_logs', foreignKeys: [{ column: 'habit_id', referencesTable: 'habits' }] },
  { table: 'task_completions', foreignKeys: [{ column: 'task_id', referencesTable: 'tasks' }] },
  {
    table: 'task_task_labels',
    foreignKeys: [
      { column: 'task_id', referencesTable: 'tasks' },
      { column: 'label_id', referencesTable: 'task_labels' },
    ],
  },
  {
    table: 'timer_logs',
    foreignKeys: [
      { column: 'habit_id', referencesTable: 'habits' },
      { column: 'task_id', referencesTable: 'tasks' },
    ],
  },
  { table: 'shopping_items', foreignKeys: [{ column: 'list_id', referencesTable: 'shopping_lists' }] },
  {
    table: 'finance_transactions',
    foreignKeys: [
      { column: 'account_id', referencesTable: 'finance_accounts' },
      { column: 'category_id', referencesTable: 'finance_categories' },
      { column: 'to_account_id', referencesTable: 'finance_accounts' },
    ],
  },
  { table: 'finance_goal_contributions', foreignKeys: [{ column: 'goal_id', referencesTable: 'finance_goals' }] },
  { table: 'finance_debt_payments', foreignKeys: [{ column: 'debt_id', referencesTable: 'finance_debts' }] },
  {
    table: 'finance_planned_payments',
    foreignKeys: [
      { column: 'account_id', referencesTable: 'finance_accounts' },
      { column: 'category_id', referencesTable: 'finance_categories' },
    ],
  },
  {
    table: 'finance_transaction_labels',
    foreignKeys: [
      { column: 'transaction_id', referencesTable: 'finance_transactions' },
      { column: 'label_id', referencesTable: 'finance_labels' },
    ],
  },
  { table: 'finance_budget_plans', foreignKeys: [{ column: 'category_id', referencesTable: 'finance_categories' }] },
  { table: 'journal_entries' },
  { table: 'journal_checkins' },
  { table: 'calendar_events' },
  { table: 'meditation_logs' },
  { table: 'meditation_custom_track' },
  { table: 'breathing_logs' },
  { table: 'affirmations' },
  { table: 'food_logs' },
  { table: 'mind_training_logs' },
  { table: 'workout_preferences' },
  { table: 'workout_logs' },
  { table: 'exercise_logs' },
  { table: 'water_preferences' },
  { table: 'water_logs' },
  { table: 'cycle_preferences' },
  { table: 'cycle_logs' },
  { table: 'cardio_activities' },
  { table: 'cardio_logs' },
  { table: 'cardio_favorite_routes' },
  { table: 'custom_workouts' },
  { table: 'routine_progress' },
  { table: 'routine_day_logs' },
  { table: 'module_reminders' },
  { table: 'body_measurements' },
  { table: 'relationship_people' },
  { table: 'relationship_checkins', foreignKeys: [{ column: 'person_id', referencesTable: 'relationship_people' }] },
  // Trend-cache tables, not new user input — see db/schema.ts's v66 migration comment for why
  // these joined the sync pipeline (so the Scoreboard/Net Worth charts match across devices)
  // despite being derived from tables that already sync on their own.
  { table: 'life_score_snapshots' },
  { table: 'finance_networth_snapshots' },
];

export function syncConfigFor(table: string): SyncTableConfig | undefined {
  return SYNC_TABLES.find((config) => config.table === table);
}
