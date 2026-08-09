export type SyncForeignKey = { column: string; referencesTable: string };

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
 */
export const SYNC_TABLES: SyncTableConfig[] = [
  { table: 'categories' },
  { table: 'finance_accounts' },
  { table: 'finance_categories' },
  { table: 'finance_budgets' },
  { table: 'finance_goals' },
  { table: 'finance_debts' },
  { table: 'finance_labels' },
  { table: 'shopping_lists' },
  { table: 'habits', foreignKeys: [{ column: 'category_id', referencesTable: 'categories' }] },
  { table: 'tasks', foreignKeys: [{ column: 'category_id', referencesTable: 'categories' }, { column: 'parent_task_id', referencesTable: 'tasks' }] },
  { table: 'habit_logs', foreignKeys: [{ column: 'habit_id', referencesTable: 'habits' }] },
  { table: 'task_completions', foreignKeys: [{ column: 'task_id', referencesTable: 'tasks' }] },
  { table: 'timer_logs', foreignKeys: [{ column: 'habit_id', referencesTable: 'habits' }] },
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
  { table: 'custom_workouts' },
  { table: 'app_settings' },
  { table: 'module_reminders' },
  { table: 'user_details' },
];

export function syncConfigFor(table: string): SyncTableConfig | undefined {
  return SYNC_TABLES.find((config) => config.table === table);
}
