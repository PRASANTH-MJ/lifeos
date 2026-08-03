import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'lifeos.db';

// Bump this and add a new `if (currentDbVersion === N)` block below whenever
// the schema changes. Never edit an already-shipped block — SQLite tables
// on real devices have already run it.
const DATABASE_VERSION = 24;

/** A deterministic, non-random id derived from a fixed string — used only for seed rows (built-in
 * categories, starter affirmations) so every fresh install gets the exact same sync_id for "the
 * same" seed content, instead of each install's independent seeding creating cloud-sync
 * duplicates of rows that are supposed to be identical everywhere. */
async function deterministicSyncId(namespace: string, key: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${namespace}:${key}`);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Seeded once, in the v5 migration below — icon/color match the reference
// category grid; every category is usable by both habits and tasks.
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

// Seeded once, in the v3 migration below — these are ordinary rows a user
// can edit, favorite, or delete like any custom affirmation; there's no
// separate "built-in" code path anywhere else in the app.
const SEED_AFFIRMATIONS = [
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
];

// Seeded once, in the v10 migration below — same starter set Finance used
// when it briefly lived in Supabase; local-only now, so no user_id needed.
const SEED_FINANCE_CATEGORIES: { name: string; type: 'income' | 'expense'; icon: string; color: string }[] = [
  { name: 'Groceries', type: 'expense', icon: 'cart', color: '#34C759' },
  { name: 'Transport', type: 'expense', icon: 'car', color: '#3D8BFF' },
  { name: 'Housing', type: 'expense', icon: 'home', color: '#FF9500' },
  { name: 'Shopping', type: 'expense', icon: 'bag', color: '#FF2D55' },
  { name: 'Health', type: 'expense', icon: 'medkit', color: '#00BCD4' },
  { name: 'Entertainment', type: 'expense', icon: 'game-controller', color: '#AF52DE' },
  { name: 'Other', type: 'expense', icon: 'ellipsis-horizontal', color: '#8E8E93' },
  { name: 'Salary', type: 'income', icon: 'cash', color: '#34C759' },
  { name: 'Freelance', type: 'income', icon: 'briefcase', color: '#3D8BFF' },
  { name: 'Investment', type: 'income', icon: 'trending-up', color: '#F5A623' },
  { name: 'Other', type: 'income', icon: 'ellipsis-horizontal', color: '#8E8E93' },
];

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = row?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
      CREATE TABLE habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'checkmark-circle',
        frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')),
        target_days TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE habit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        UNIQUE(habit_id, date)
      );
      CREATE INDEX idx_habit_logs_habit_id ON habit_logs(habit_id);

      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        notes TEXT,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        due_date TEXT,
        completed_at TEXT,
        parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

      CREATE TABLE journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        body TEXT NOT NULL,
        mood TEXT,
        prompt TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    currentDbVersion = 1;
  }

  if (currentDbVersion === 1) {
    await db.execAsync(`
      CREATE TABLE calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        notes TEXT,
        date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_calendar_events_date ON calendar_events(date);

      CREATE TABLE meditation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_key TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        completed_at TEXT NOT NULL
      );
      CREATE INDEX idx_meditation_logs_completed_at ON meditation_logs(completed_at);

      CREATE TABLE breathing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_key TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        cycles INTEGER NOT NULL,
        completed_at TEXT NOT NULL
      );
      CREATE INDEX idx_breathing_logs_completed_at ON breathing_logs(completed_at);
    `);
    currentDbVersion = 2;
  }

  if (currentDbVersion === 2) {
    await db.execAsync(`
      CREATE TABLE affirmations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        is_custom INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE finance_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_finance_transactions_date ON finance_transactions(date);

      CREATE TABLE food_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
        calories INTEGER NOT NULL,
        protein_g INTEGER,
        carbs_g INTEGER,
        fat_g INTEGER,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_food_logs_date ON food_logs(date);
    `);

    const seededAt = new Date().toISOString();
    for (const text of SEED_AFFIRMATIONS) {
      await db.runAsync('INSERT INTO affirmations (text, is_favorite, is_custom, created_at) VALUES (?, 0, 0, ?)', [
        text,
        seededAt,
      ]);
    }

    currentDbVersion = 3;
  }

  if (currentDbVersion === 3) {
    await db.execAsync(`
      CREATE TABLE mind_training_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_key TEXT NOT NULL,
        score REAL NOT NULL,
        completed_at TEXT NOT NULL
      );
      CREATE INDEX idx_mind_training_logs_exercise ON mind_training_logs(exercise_key);

      CREATE TABLE workout_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        goal TEXT NOT NULL DEFAULT 'general',
        equipment TEXT NOT NULL DEFAULT '[]',
        time_minutes INTEGER NOT NULL DEFAULT 30,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_key TEXT NOT NULL,
        completed_at TEXT NOT NULL
      );
      CREATE INDEX idx_workout_logs_completed_at ON workout_logs(completed_at);
    `);

    await db.runAsync(
      "INSERT INTO workout_preferences (id, goal, equipment, time_minutes, updated_at) VALUES (1, 'general', '[]', 30, ?)",
      [new Date().toISOString()]
    );

    currentDbVersion = 4;
  }

  if (currentDbVersion === 4) {
    // Rebuilding habits/tasks with new CHECK constraints requires recreating
    // the tables (SQLite can't ALTER a CHECK) — foreign_keys is switched off
    // for just this block so the old→new table swaps don't trip enforcement
    // on the interim dangling references.
    await db.execAsync('PRAGMA foreign_keys = OFF');

    await db.execAsync(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        applies_to TEXT NOT NULL DEFAULT 'both' CHECK (applies_to IN ('habit', 'task', 'both')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE habits_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'checkmark-circle',
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        tracking_type TEXT NOT NULL DEFAULT 'yesno' CHECK (tracking_type IN ('yesno', 'numeric', 'timer', 'checklist')),
        target_value REAL,
        target_unit TEXT,
        target_comparator TEXT NOT NULL DEFAULT 'at_least' CHECK (target_comparator IN ('at_least', 'at_most', 'exactly')),
        checklist_items TEXT NOT NULL DEFAULT '[]',
        checklist_success_mode TEXT NOT NULL DEFAULT 'all' CHECK (checklist_success_mode IN ('all', 'custom')),
        checklist_min_count INTEGER NOT NULL DEFAULT 0,
        frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'periodic')),
        target_days TEXT NOT NULL DEFAULT '[]',
        period_target_count INTEGER,
        period_length_days INTEGER,
        created_at TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO habits_new (id, name, icon, frequency, target_days, created_at, archived)
        SELECT id, name, icon, frequency, target_days, created_at, archived FROM habits;
      DROP TABLE habits;
      ALTER TABLE habits_new RENAME TO habits;

      CREATE TABLE habit_logs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'fail', 'skip')),
        value REAL,
        checklist_checked TEXT,
        note TEXT,
        completed_at TEXT NOT NULL,
        UNIQUE(habit_id, date)
      );
      INSERT INTO habit_logs_new (id, habit_id, date, status, completed_at)
        SELECT id, habit_id, date, 'done', completed_at FROM habit_logs;
      DROP TABLE habit_logs;
      ALTER TABLE habit_logs_new RENAME TO habit_logs;
      CREATE INDEX idx_habit_logs_habit_id ON habit_logs(habit_id);

      CREATE TABLE tasks_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        notes TEXT,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        important INTEGER NOT NULL DEFAULT 0,
        due_date TEXT,
        due_time TEXT,
        completed_at TEXT,
        parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly')),
        recurrence_days TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO tasks_new (id, title, notes, priority, due_date, completed_at, parent_task_id, sort_order, created_at, archived)
        SELECT id, title, notes, priority, due_date, completed_at, parent_task_id, sort_order, created_at, archived FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

      CREATE TABLE task_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'fail', 'skip')),
        completed_at TEXT NOT NULL,
        UNIQUE(task_id, date)
      );
      CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);

      CREATE TABLE timer_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT,
        habit_id INTEGER REFERENCES habits(id) ON DELETE SET NULL,
        duration_seconds INTEGER NOT NULL,
        completed_at TEXT NOT NULL
      );
      CREATE INDEX idx_timer_logs_completed_at ON timer_logs(completed_at);
    `);

    await db.execAsync('PRAGMA foreign_keys = ON');

    const seededAt = new Date().toISOString();
    for (const category of SEED_CATEGORIES) {
      await db.runAsync('INSERT INTO categories (name, icon, color, applies_to, created_at) VALUES (?, ?, ?, ?, ?)', [
        category.name,
        category.icon,
        category.color,
        'both',
        seededAt,
      ]);
    }

    currentDbVersion = 5;
  }

  if (currentDbVersion === 5) {
    // Recurring tasks gain the same 'periodic' frequency ("X times per Y
    // days") habits already have — another CHECK-constraint change, so
    // another table rebuild.
    await db.execAsync('PRAGMA foreign_keys = OFF');

    await db.execAsync(`
      CREATE TABLE tasks_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        notes TEXT,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        important INTEGER NOT NULL DEFAULT 0,
        due_date TEXT,
        due_time TEXT,
        completed_at TEXT,
        parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly', 'periodic')),
        recurrence_days TEXT NOT NULL DEFAULT '[]',
        period_target_count INTEGER,
        period_length_days INTEGER,
        created_at TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO tasks_new (
        id, title, notes, priority, category_id, important, due_date, due_time, completed_at,
        parent_task_id, sort_order, is_recurring, recurrence_frequency, recurrence_days, created_at, archived
      )
        SELECT
          id, title, notes, priority, category_id, important, due_date, due_time, completed_at,
          parent_task_id, sort_order, is_recurring, recurrence_frequency, recurrence_days, created_at, archived
        FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
    `);

    await db.execAsync('PRAGMA foreign_keys = ON');

    currentDbVersion = 6;
  }

  if (currentDbVersion === 6) {
    // Plain additive columns (no CHECK constraint), so a simple ADD COLUMN
    // is enough here — no table rebuild needed this time.
    await db.execAsync(`
      CREATE TABLE app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        time_format TEXT NOT NULL DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
        updated_at TEXT NOT NULL
      );

      ALTER TABLE tasks ADD COLUMN reminder_offset_minutes INTEGER;
      ALTER TABLE tasks ADD COLUMN alarm_enabled INTEGER NOT NULL DEFAULT 0;
    `);

    await db.runAsync("INSERT INTO app_settings (id, time_format, updated_at) VALUES (1, '24h', ?)", [
      new Date().toISOString(),
    ]);

    currentDbVersion = 7;
  }

  if (currentDbVersion === 7) {
    await db.execAsync(`
      CREATE TABLE shopping_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quantity TEXT,
        checked INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_shopping_items_checked ON shopping_items(checked);
    `);

    currentDbVersion = 8;
  }

  if (currentDbVersion === 8) {
    // Single upserted row, same pattern as workout_preferences/app_settings —
    // null budget fields mean "not tracking a budget for that period".
    await db.execAsync(`
      CREATE TABLE finance_budgets (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        weekly_budget REAL,
        monthly_budget REAL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.runAsync('INSERT INTO finance_budgets (id, weekly_budget, monthly_budget, updated_at) VALUES (1, NULL, NULL, ?)', [
      new Date().toISOString(),
    ]);

    currentDbVersion = 9;
  }

  if (currentDbVersion === 9) {
    // Finance moves back to local SQLite (it briefly lived in Supabase this
    // session) — same accounts/categories/transactions model, same balance
    // recalculation logic, just running as SQLite triggers instead of a
    // Postgres one. `finance_transactions` here replaces the old unused v2
    // table of the same name (flat expense/income rows, no accounts) — that
    // table was already dead code, superseded before anyone relied on it.
    await db.execAsync('PRAGMA foreign_keys = OFF');
    await db.execAsync(`
      DROP TABLE IF EXISTS finance_transactions;

      CREATE TABLE finance_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('general', 'cash', 'investment', 'credit')),
        currency TEXT NOT NULL DEFAULT 'USD',
        current_balance REAL NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE finance_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        icon TEXT NOT NULL DEFAULT 'pricetag',
        color TEXT NOT NULL DEFAULT '#6C63FF'
      );

      CREATE TABLE finance_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES finance_categories(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
        amount REAL NOT NULL CHECK (amount > 0),
        date TEXT NOT NULL,
        note TEXT,
        to_account_id INTEGER REFERENCES finance_accounts(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL,
        CHECK (
          (type = 'transfer' AND to_account_id IS NOT NULL AND to_account_id <> account_id AND category_id IS NULL)
          OR (type <> 'transfer' AND to_account_id IS NULL)
        )
      );
      CREATE INDEX idx_finance_transactions_account_id ON finance_transactions(account_id);
      CREATE INDEX idx_finance_transactions_date ON finance_transactions(date);

      CREATE TRIGGER trg_finance_tx_insert AFTER INSERT ON finance_transactions BEGIN
        UPDATE finance_accounts
          SET current_balance = current_balance + (CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END),
              updated_at = datetime('now')
          WHERE id = NEW.account_id;
        UPDATE finance_accounts
          SET current_balance = current_balance + NEW.amount, updated_at = datetime('now')
          WHERE NEW.type = 'transfer' AND id = NEW.to_account_id;
      END;

      CREATE TRIGGER trg_finance_tx_delete AFTER DELETE ON finance_transactions BEGIN
        UPDATE finance_accounts
          SET current_balance = current_balance - (CASE WHEN OLD.type = 'income' THEN OLD.amount ELSE -OLD.amount END),
              updated_at = datetime('now')
          WHERE id = OLD.account_id;
        UPDATE finance_accounts
          SET current_balance = current_balance - OLD.amount, updated_at = datetime('now')
          WHERE OLD.type = 'transfer' AND id = OLD.to_account_id;
      END;

      CREATE TRIGGER trg_finance_tx_update AFTER UPDATE ON finance_transactions BEGIN
        UPDATE finance_accounts
          SET current_balance = current_balance - (CASE WHEN OLD.type = 'income' THEN OLD.amount ELSE -OLD.amount END),
              updated_at = datetime('now')
          WHERE id = OLD.account_id;
        UPDATE finance_accounts
          SET current_balance = current_balance - OLD.amount, updated_at = datetime('now')
          WHERE OLD.type = 'transfer' AND id = OLD.to_account_id;
        UPDATE finance_accounts
          SET current_balance = current_balance + (CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END),
              updated_at = datetime('now')
          WHERE id = NEW.account_id;
        UPDATE finance_accounts
          SET current_balance = current_balance + NEW.amount, updated_at = datetime('now')
          WHERE NEW.type = 'transfer' AND id = NEW.to_account_id;
      END;
    `);
    await db.execAsync('PRAGMA foreign_keys = ON');

    for (const category of SEED_FINANCE_CATEGORIES) {
      await db.runAsync('INSERT INTO finance_categories (name, type, icon, color) VALUES (?, ?, ?, ?)', [
        category.name,
        category.type,
        category.icon,
        category.color,
      ]);
    }

    currentDbVersion = 10;
  }

  if (currentDbVersion === 10) {
    // Plain additive columns (no CHECK constraint), so ADD COLUMN is enough —
    // no table rebuild needed. Habits gain the same reminder/alarm concept
    // Tasks already had, just as a daily time-of-day (habits recur, so there's
    // no single due moment to offset from). Shopping items gain a price so
    // the list can track a running total.
    await db.execAsync(`
      ALTER TABLE habits ADD COLUMN reminder_time TEXT;
      ALTER TABLE habits ADD COLUMN alarm_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE shopping_items ADD COLUMN price REAL;
    `);

    currentDbVersion = 11;
  }

  if (currentDbVersion === 11) {
    // Single upserted rows, same pattern as app_settings/workout_preferences.
    // user_profile is purely local — name/picture/optional app-lock PIN, not
    // an account (there is no login system in this app). pin_hash is a
    // SHA-256 digest (expo-crypto), never the plain PIN.
    await db.execAsync(`
      CREATE TABLE user_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT,
        avatar_uri TEXT,
        pin_hash TEXT,
        pin_enabled INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE meditation_custom_track (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        uri TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await db.runAsync('INSERT INTO user_profile (id, name, avatar_uri, pin_hash, pin_enabled, updated_at) VALUES (1, NULL, NULL, NULL, 0, ?)', [
      new Date().toISOString(),
    ]);

    currentDbVersion = 12;
  }

  if (currentDbVersion === 12) {
    // A user-provided affirmation image comes with its own fixed caption baked
    // in ("Be Good to Yourself"), so it's paired with a matching new
    // affirmation row (by exact text, in backgrounds.ts) rather than dropped
    // into the generic rotating-background pool.
    await db.runAsync(
      "INSERT INTO affirmations (text, is_favorite, is_custom, created_at) VALUES ('Be Good to Yourself', 0, 1, ?)",
      [new Date().toISOString()]
    );

    currentDbVersion = 13;
  }

  if (currentDbVersion === 13) {
    // 13 more user-provided affirmation images, each with its own caption baked
    // in, paired with a matching new affirmation row (by exact text, in
    // backgrounds.ts) rather than dropped into the generic background pool.
    const seededAt = new Date().toISOString();
    const CUSTOM_AFFIRMATIONS = [
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
    for (const text of CUSTOM_AFFIRMATIONS) {
      await db.runAsync(
        'INSERT INTO affirmations (text, is_favorite, is_custom, created_at) VALUES (?, 0, 1, ?)',
        [text, seededAt]
      );
    }

    currentDbVersion = 14;
  }

  if (currentDbVersion === 14) {
    // Finance analytics rework: each expense category gets a Must/Need/Want
    // priority (for the "nature of spending" breakdown) — plain ADD COLUMN
    // since it's an unconstrained default, no table rebuild needed.
    await db.execAsync("ALTER TABLE finance_categories ADD COLUMN priority TEXT NOT NULL DEFAULT 'need'");

    const CATEGORY_PRIORITIES: Record<string, 'must' | 'need' | 'want'> = {
      Housing: 'must',
      Health: 'must',
      Groceries: 'need',
      Transport: 'need',
      Shopping: 'want',
      Entertainment: 'want',
    };
    for (const [name, priority] of Object.entries(CATEGORY_PRIORITIES)) {
      await db.runAsync("UPDATE finance_categories SET priority = ? WHERE name = ? AND type = 'expense'", [priority, name]);
    }

    currentDbVersion = 15;
  }

  if (currentDbVersion === 15) {
    // Four more Finance features, each independent: Goals (savings targets,
    // tracked separately from the account/transaction ledger — a goal is a
    // target to save toward, not money that's left an account), Debts
    // (money lent/borrowed, with partial repayments), Planned payments
    // (known future income/expense, feeding the Outlook forecast), and
    // Labels (free-form tags on transactions, independent of category).
    await db.execAsync(`
      CREATE TABLE finance_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'flag',
        color TEXT NOT NULL DEFAULT '#3D8BFF',
        target_amount REAL NOT NULL CHECK (target_amount > 0),
        target_date TEXT,
        current_amount REAL NOT NULL DEFAULT 0,
        is_closed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE finance_goal_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL REFERENCES finance_goals(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_finance_goal_contributions_goal_id ON finance_goal_contributions(goal_id);

      CREATE TRIGGER trg_finance_goal_contribution_insert AFTER INSERT ON finance_goal_contributions BEGIN
        UPDATE finance_goals SET current_amount = current_amount + NEW.amount WHERE id = NEW.goal_id;
      END;
      CREATE TRIGGER trg_finance_goal_contribution_delete AFTER DELETE ON finance_goal_contributions BEGIN
        UPDATE finance_goals SET current_amount = current_amount - OLD.amount WHERE id = OLD.goal_id;
      END;

      CREATE TABLE finance_debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_name TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
        amount REAL NOT NULL CHECK (amount > 0),
        note TEXT,
        is_closed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        closed_at TEXT
      );

      CREATE TABLE finance_debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL REFERENCES finance_debts(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_finance_debt_payments_debt_id ON finance_debt_payments(debt_id);

      CREATE TABLE finance_planned_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES finance_categories(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL CHECK (amount > 0),
        payee TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK (frequency IN ('once', 'weekly', 'monthly', 'yearly')),
        next_date TEXT NOT NULL,
        notify INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_finance_planned_payments_next_date ON finance_planned_payments(next_date);

      CREATE TABLE finance_labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#8E8E93'
      );

      CREATE TABLE finance_transaction_labels (
        transaction_id INTEGER NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
        label_id INTEGER NOT NULL REFERENCES finance_labels(id) ON DELETE CASCADE,
        PRIMARY KEY (transaction_id, label_id)
      );
    `);

    currentDbVersion = 16;
  }

  if (currentDbVersion === 16) {
    // Named, multi-period budgets (Weekly/Monthly/Yearly/One-time), separate from the older
    // single weekly/monthly figure in `finance_budgets` — that simple pair stays as the Finance
    // home screen's quick-glance card; this table backs a full Budgets screen with several
    // budgets per period, each optionally scoped to one category, with a pacing forecast.
    await db.execAsync(`
      CREATE TABLE finance_budget_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly', 'one_time')),
        amount REAL NOT NULL CHECK (amount > 0),
        category_id INTEGER REFERENCES finance_categories(id) ON DELETE SET NULL,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        CHECK (period <> 'one_time' OR (start_date IS NOT NULL AND end_date IS NOT NULL))
      );
      CREATE INDEX idx_finance_budget_plans_period ON finance_budget_plans(period);
    `);

    currentDbVersion = 17;
  }

  if (currentDbVersion === 17) {
    // Manual drag-style reordering for Habits and Recurring tasks (both otherwise ordered only
    // by created_at) — backfilled from the current created_at order so existing lists don't
    // visually jump the moment this ships; from here on, moveHabit/moveRecurringTask swap two
    // rows' sort_order directly.
    await db.execAsync("ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    await db.execAsync(`
      UPDATE habits SET sort_order = (
        SELECT COUNT(*) FROM habits h2
        WHERE h2.created_at < habits.created_at OR (h2.created_at = habits.created_at AND h2.id < habits.id)
      )
    `);
    await db.execAsync(`
      UPDATE tasks SET sort_order = (
        SELECT COUNT(*) FROM tasks t2
        WHERE t2.is_recurring = 1 AND (t2.created_at < tasks.created_at OR (t2.created_at = tasks.created_at AND t2.id < tasks.id))
      ) WHERE is_recurring = 1
    `);

    currentDbVersion = 18;
  }

  if (currentDbVersion === 18) {
    // Multiple named shopping lists instead of one flat list — existing items all move into a
    // single "Shopping" list so nothing already on someone's list disappears.
    await db.execAsync(`
      CREATE TABLE shopping_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    const defaultListId = await db.runAsync('INSERT INTO shopping_lists (name, created_at) VALUES (?, ?)', [
      'Shopping',
      new Date().toISOString(),
    ]);

    await db.execAsync('PRAGMA foreign_keys = OFF');
    await db.execAsync(`
      CREATE TABLE shopping_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        quantity TEXT,
        price REAL,
        checked INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
    await db.runAsync(
      `INSERT INTO shopping_items_new (id, list_id, name, quantity, price, checked, sort_order, created_at)
       SELECT id, ?, name, quantity, price, checked, sort_order, created_at FROM shopping_items`,
      [defaultListId.lastInsertRowId]
    );
    await db.execAsync(`
      DROP TABLE shopping_items;
      ALTER TABLE shopping_items_new RENAME TO shopping_items;
      CREATE INDEX idx_shopping_items_list_id ON shopping_items(list_id);
    `);
    await db.execAsync('PRAGMA foreign_keys = ON');

    currentDbVersion = 19;
  }

  if (currentDbVersion === 19) {
    // One generic table backs a daily reminder/alarm toggle for any module that wants one
    // (Journal, Meditation, Breathing, Mind Training, Workout, Food, Affirmations) — a single
    // row per module keyed by a stable string, rather than seven near-identical tables.
    await db.execAsync(`
      CREATE TABLE module_reminders (
        module_key TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        reminder_time TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    // User-created workouts, alongside the built-in WORKOUTS catalog (which stays in code —
    // it's fixed reference content, not user data).
    await db.execAsync(`
      CREATE TABLE custom_workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        goal TEXT NOT NULL CHECK (goal IN ('general', 'strength', 'cardio', 'flexibility')),
        equipment TEXT NOT NULL CHECK (equipment IN ('none', 'dumbbells', 'full-gym')),
        minutes INTEGER NOT NULL,
        exercises TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
    `);

    currentDbVersion = 20;
  }

  if (currentDbVersion === 20) {
    // Module reminders gain a type (silent/notification/alarm-style sound) and a schedule
    // (every day vs. specific weekdays) instead of a plain on/off toggle — the old `enabled`
    // column backfills into 'notification' so nobody's existing reminder silently vanishes.
    await db.execAsync("ALTER TABLE module_reminders ADD COLUMN reminder_type TEXT NOT NULL DEFAULT 'none'");
    await db.execAsync("ALTER TABLE module_reminders ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'daily'");
    await db.execAsync("ALTER TABLE module_reminders ADD COLUMN schedule_days TEXT NOT NULL DEFAULT '[]'");
    await db.execAsync("UPDATE module_reminders SET reminder_type = 'notification' WHERE enabled = 1");

    currentDbVersion = 21;
  }

  if (currentDbVersion === 21) {
    // Premium entitlement, cached locally so the app stays instant/offline like every other
    // screen — Firestore (`users/{uid}.premium`) is the actual source of truth, reconciled into
    // these columns on auth-state change and app-foreground (see modules/premium/usePremium.ts).
    await db.execAsync('ALTER TABLE user_profile ADD COLUMN firebase_uid TEXT');
    await db.execAsync('ALTER TABLE user_profile ADD COLUMN premium INTEGER NOT NULL DEFAULT 0');
    await db.execAsync('ALTER TABLE user_profile ADD COLUMN premium_synced_at TEXT');

    currentDbVersion = 22;
  }

  if (currentDbVersion === 22) {
    // Morning/night check-ins — a separate, structured capability alongside the existing
    // free-text journal entries, not a replacement for them. One row per day per type, enforced
    // by the UNIQUE constraint (saving again the same day upserts rather than duplicating).
    await db.execAsync(`
      CREATE TABLE journal_checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('morning', 'night')),
        energy INTEGER,
        sleep_bucket TEXT,
        stress INTEGER,
        first_reached_for TEXT,
        productivity INTEGER,
        mood TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(date, type)
      );
    `);

    // module_reminders.module_key was the PRIMARY KEY, capping every module at exactly one
    // reminder — rebuilding with a surrogate id lets a module have several (e.g. a morning and
    // an evening meditation reminder), same "create _new, copy, drop, rename" idiom as every
    // other structural change in this file.
    await db.execAsync(`
      CREATE TABLE module_reminders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_key TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        reminder_time TEXT,
        reminder_type TEXT NOT NULL DEFAULT 'none',
        schedule_type TEXT NOT NULL DEFAULT 'daily',
        schedule_days TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );
      INSERT INTO module_reminders_new (module_key, enabled, reminder_time, reminder_type, schedule_type, schedule_days, updated_at)
        SELECT module_key, enabled, reminder_time, reminder_type, schedule_type, schedule_days, updated_at FROM module_reminders;
      DROP TABLE module_reminders;
      ALTER TABLE module_reminders_new RENAME TO module_reminders;
    `);

    currentDbVersion = 23;
  }

  if (currentDbVersion === 23) {
    // Cross-device sync groundwork — every table gets a `sync_id` (a UUID, stable across
    // devices, unlike the local auto-increment `id` two offline devices could independently
    // reuse) and an `updated_at` that's actually maintained on every write (most tables here only
    // ever had `created_at`, or an event timestamp like `completed_at`, neither of which changes
    // on update — useless as a "what changed" signal for sync). See modules/sync/ for how these
    // get used; this block only adds the columns and backfills existing rows.
    const ALL_SYNCED_TABLES = [
      'habits', 'habit_logs', 'tasks', 'task_completions', 'journal_entries', 'journal_checkins',
      'calendar_events', 'meditation_logs', 'meditation_custom_track', 'breathing_logs', 'affirmations',
      'finance_transactions', 'food_logs', 'mind_training_logs', 'workout_preferences', 'workout_logs',
      'categories', 'app_settings', 'shopping_items', 'finance_budgets', 'finance_accounts',
      'finance_categories', 'user_profile', 'finance_goals', 'finance_goal_contributions', 'finance_debts',
      'finance_debt_payments', 'finance_planned_payments', 'finance_labels', 'finance_transaction_labels',
      'finance_budget_plans', 'timer_logs', 'module_reminders', 'shopping_lists', 'custom_workouts',
    ];
    for (const table of ALL_SYNCED_TABLES) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN sync_id TEXT`);
    }

    // Already had a real, maintained updated_at before this migration.
    const HAS_UPDATED_AT = new Set([
      'journal_entries', 'journal_checkins', 'workout_preferences', 'app_settings',
      'finance_budgets', 'finance_accounts', 'user_profile', 'module_reminders',
    ]);
    // Everything else needs the column added and backfilled from whatever timestamp it does have.
    const BACKFILL_FROM_CREATED_AT = [
      'habits', 'tasks', 'calendar_events', 'meditation_custom_track', 'affirmations',
      'finance_transactions', 'food_logs', 'categories', 'shopping_items', 'finance_goals',
      'finance_goal_contributions', 'finance_debts', 'finance_debt_payments', 'finance_planned_payments',
      'finance_budget_plans', 'shopping_lists', 'custom_workouts',
    ];
    const BACKFILL_FROM_COMPLETED_AT = [
      'habit_logs', 'task_completions', 'meditation_logs', 'breathing_logs', 'mind_training_logs',
      'workout_logs', 'timer_logs',
    ];
    const BACKFILL_FROM_NOW = ['finance_categories', 'finance_labels', 'finance_transaction_labels'];

    for (const table of ALL_SYNCED_TABLES) {
      if (HAS_UPDATED_AT.has(table)) continue;
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT`);
    }
    for (const table of BACKFILL_FROM_CREATED_AT) {
      await db.execAsync(`UPDATE ${table} SET updated_at = created_at WHERE updated_at IS NULL`);
    }
    for (const table of BACKFILL_FROM_COMPLETED_AT) {
      await db.execAsync(`UPDATE ${table} SET updated_at = completed_at WHERE updated_at IS NULL`);
    }
    const now = new Date().toISOString();
    for (const table of BACKFILL_FROM_NOW) {
      await db.runAsync(`UPDATE ${table} SET updated_at = ? WHERE updated_at IS NULL`, [now]);
    }

    // Singleton config rows (always id = 1) — a fixed, non-random sync_id is exactly as
    // deterministic as they need, since there's only ever one row.
    for (const table of ['workout_preferences', 'app_settings', 'finance_budgets', 'user_profile']) {
      await db.execAsync(`UPDATE ${table} SET sync_id = 'singleton' WHERE sync_id IS NULL`);
    }

    // Seed rows (built-in categories, finance categories, starter affirmations) get deterministic
    // ids derived from their fixed content, so a second device's fresh install seeds the *same*
    // sync_ids instead of creating duplicate rows once both sides sync. Any affirmation whose text
    // isn't in this known-seed list is a real user-added one and gets a random id below instead.
    for (const category of SEED_CATEGORIES) {
      const syncId = await deterministicSyncId('category', category.name);
      await db.runAsync('UPDATE categories SET sync_id = ? WHERE name = ? AND sync_id IS NULL', [syncId, category.name]);
    }
    for (const category of SEED_FINANCE_CATEGORIES) {
      const syncId = await deterministicSyncId('finance_category', `${category.name}:${category.type}`);
      await db.runAsync('UPDATE finance_categories SET sync_id = ? WHERE name = ? AND type = ? AND sync_id IS NULL', [
        syncId,
        category.name,
        category.type,
      ]);
    }
    const KNOWN_SEED_AFFIRMATIONS = [
      ...SEED_AFFIRMATIONS,
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
    for (const text of KNOWN_SEED_AFFIRMATIONS) {
      const syncId = await deterministicSyncId('affirmation', text);
      await db.runAsync('UPDATE affirmations SET sync_id = ? WHERE text = ? AND sync_id IS NULL', [syncId, text]);
    }

    // Everything else with existing rows (real user data — habits, tasks, transactions, journal
    // entries, etc.) gets a random UUID per row, since there's no fixed content to derive from.
    const RANDOM_BACKFILL_TABLES = ALL_SYNCED_TABLES.filter(
      (table) =>
        !['workout_preferences', 'app_settings', 'finance_budgets', 'user_profile', 'categories', 'finance_categories', 'affirmations', 'finance_transaction_labels'].includes(
          table
        )
    );
    for (const table of RANDOM_BACKFILL_TABLES) {
      const rows = await db.getAllAsync<{ id: number }>(`SELECT id FROM ${table} WHERE sync_id IS NULL`);
      for (const row of rows) {
        await db.runAsync(`UPDATE ${table} SET sync_id = ? WHERE id = ?`, [Crypto.randomUUID(), row.id]);
      }
    }
    // No single `id` column (composite PRIMARY KEY (transaction_id, label_id)) — handled separately.
    const transactionLabelRows = await db.getAllAsync<{ transaction_id: number; label_id: number }>(
      'SELECT transaction_id, label_id FROM finance_transaction_labels WHERE sync_id IS NULL'
    );
    for (const row of transactionLabelRows) {
      await db.runAsync('UPDATE finance_transaction_labels SET sync_id = ? WHERE transaction_id = ? AND label_id = ?', [
        Crypto.randomUUID(),
        row.transaction_id,
        row.label_id,
      ]);
    }
    // Any remaining seed rows without an app-level insert path (categories/finance_categories) or
    // any affirmation that somehow didn't match the known-seed list still needs *some* sync_id.
    for (const table of ['categories', 'finance_categories', 'affirmations']) {
      const rows = await db.getAllAsync<{ id: number }>(`SELECT id FROM ${table} WHERE sync_id IS NULL`);
      for (const row of rows) {
        await db.runAsync(`UPDATE ${table} SET sync_id = ? WHERE id = ?`, [Crypto.randomUUID(), row.id]);
      }
    }

    // Indexes on sync_id for the tables other tables' foreign keys resolve against during a
    // remote-record merge (see modules/sync/syncSchema.ts).
    await db.execAsync(`
      CREATE INDEX idx_habits_sync_id ON habits(sync_id);
      CREATE INDEX idx_tasks_sync_id ON tasks(sync_id);
      CREATE INDEX idx_categories_sync_id ON categories(sync_id);
      CREATE INDEX idx_finance_accounts_sync_id ON finance_accounts(sync_id);
      CREATE INDEX idx_finance_categories_sync_id ON finance_categories(sync_id);
      CREATE INDEX idx_finance_goals_sync_id ON finance_goals(sync_id);
      CREATE INDEX idx_finance_debts_sync_id ON finance_debts(sync_id);
      CREATE INDEX idx_finance_labels_sync_id ON finance_labels(sync_id);
      CREATE INDEX idx_finance_transactions_sync_id ON finance_transactions(sync_id);
      CREATE INDEX idx_shopping_lists_sync_id ON shopping_lists(sync_id);
    `);

    // Tombstones (recorded before a hard DELETE, so a remote listener can tell "deleted" apart
    // from "never existed") and the offline outbox (every local write lands here first, so it
    // survives an app restart while offline; flushed on regained connectivity/app foreground).
    await db.execAsync(`
      CREATE TABLE sync_tombstones (
        sync_id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        deleted_at TEXT NOT NULL
      );
      CREATE TABLE sync_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        sync_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    currentDbVersion = 24;
  }

  // Future modules land here as `if (currentDbVersion === 24) { ... currentDbVersion = 25; }`
  // — each module owns its own tables; the Analytics Dashboard only ever adds
  // read-only queries against these, never its own tables.

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
