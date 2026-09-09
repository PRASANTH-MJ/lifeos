import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import bundledExercises from '../modules/workout/data/exercises.json';

export const DATABASE_NAME = 'lifeos.db';

// Bump this and add a new `if (currentDbVersion === N)` block below whenever
// the schema changes. Never edit an already-shipped block — SQLite tables
// on real devices have already run it.
const DATABASE_VERSION = 67;

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
    await db.execAsync(`PRAGMA user_version = 1`);
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
    await db.execAsync(`PRAGMA user_version = 2`);
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
    await db.execAsync(`PRAGMA user_version = 3`);
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
    await db.execAsync(`PRAGMA user_version = 4`);
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
    await db.execAsync(`PRAGMA user_version = 5`);
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
    await db.execAsync(`PRAGMA user_version = 6`);
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
    await db.execAsync(`PRAGMA user_version = 7`);
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
    await db.execAsync(`PRAGMA user_version = 8`);
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
    await db.execAsync(`PRAGMA user_version = 9`);
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
    await db.execAsync(`PRAGMA user_version = 10`);
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
    await db.execAsync(`PRAGMA user_version = 11`);
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
    await db.execAsync(`PRAGMA user_version = 12`);
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
    await db.execAsync(`PRAGMA user_version = 13`);
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
    await db.execAsync(`PRAGMA user_version = 14`);
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
    await db.execAsync(`PRAGMA user_version = 15`);
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
    await db.execAsync(`PRAGMA user_version = 16`);
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
    await db.execAsync(`PRAGMA user_version = 17`);
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
    await db.execAsync(`PRAGMA user_version = 18`);
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
    await db.execAsync(`PRAGMA user_version = 19`);
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
    await db.execAsync(`PRAGMA user_version = 20`);
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
    await db.execAsync(`PRAGMA user_version = 21`);
  }

  if (currentDbVersion === 21) {
    // Premium entitlement, cached locally so the app stays instant/offline like every other
    // screen — Firestore (`users/{uid}.premium`) is the actual source of truth, reconciled into
    // these columns on auth-state change and app-foreground (see modules/premium/usePremium.ts).
    await db.execAsync('ALTER TABLE user_profile ADD COLUMN firebase_uid TEXT');
    await db.execAsync('ALTER TABLE user_profile ADD COLUMN premium INTEGER NOT NULL DEFAULT 0');
    await db.execAsync('ALTER TABLE user_profile ADD COLUMN premium_synced_at TEXT');

    currentDbVersion = 22;
    await db.execAsync(`PRAGMA user_version = 22`);
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
    await db.execAsync(`PRAGMA user_version = 23`);
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
    await db.execAsync(`PRAGMA user_version = 24`);
  }

  if (currentDbVersion === 24) {
    // Optional, skippable onboarding profile data (DOB, height/weight + a health goal, income
    // bracket + a financial goal) — its own singleton table rather than folding into
    // `user_profile`, since user_profile is deliberately excluded from sync (see
    // modules/sync/syncSchema.ts) for its device-specific PIN, and this data should follow the
    // account across devices like any other synced table.
    await db.execAsync(`
      CREATE TABLE user_details (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        phone_number TEXT,
        date_of_birth TEXT,
        height_cm REAL,
        weight_kg REAL,
        health_goal TEXT,
        income_bracket TEXT,
        financial_goal TEXT,
        onboarding_done INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_user_details_sync_id ON user_details(sync_id);
    `);
    // Deliberately NOT `new Date().toISOString()` — the sync engine's merge is last-write-wins by
    // `updated_at` (see modules/sync/syncEngine.ts's mergeRemoteRecord), so seeding this fresh
    // placeholder row with "now" would make it look newer than a real onboarding_done update from
    // days ago on another device, and the merge would wrongly keep this blank row instead of
    // pulling down the real one. An epoch timestamp guarantees any real remote update wins.
    await db.runAsync("INSERT INTO user_details (id, onboarding_done, updated_at, sync_id) VALUES (1, 0, '1970-01-01T00:00:00.000Z', 'singleton')");

    currentDbVersion = 25;
    await db.execAsync(`PRAGMA user_version = 25`);
  }

  if (currentDbVersion === 25) {
    // Per-exercise set/rep/weight logging for the exercise library — distinct from workout_logs
    // (which just marks a whole pre-built workout complete for the day). exercise_key references
    // the bundled exercises.json dataset, not a DB row, so there's no foreign key.
    await db.execAsync(`
      CREATE TABLE exercise_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_key TEXT NOT NULL,
        date TEXT NOT NULL,
        sets INTEGER,
        reps INTEGER,
        weight_kg REAL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_exercise_logs_exercise_key ON exercise_logs(exercise_key);
      CREATE INDEX idx_exercise_logs_date ON exercise_logs(date);
      CREATE INDEX idx_exercise_logs_sync_id ON exercise_logs(sync_id);
    `);

    currentDbVersion = 26;
    await db.execAsync(`PRAGMA user_version = 26`);
  }

  if (currentDbVersion === 26) {
    await db.execAsync(`
      CREATE TABLE water_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        goal_ml INTEGER NOT NULL DEFAULT 2000,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE water_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount_ml INTEGER NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_water_logs_date ON water_logs(date);
      CREATE INDEX idx_water_logs_sync_id ON water_logs(sync_id);
    `);
    await db.runAsync("INSERT INTO water_preferences (id, goal_ml, updated_at) VALUES (1, 2000, ?)", [new Date().toISOString()]);

    currentDbVersion = 27;
    await db.execAsync(`PRAGMA user_version = 27`);
  }

  if (currentDbVersion === 27) {
    await db.execAsync('ALTER TABLE workout_logs ADD COLUMN duration_seconds INTEGER');

    currentDbVersion = 28;
    await db.execAsync(`PRAGMA user_version = 28`);
  }

  if (currentDbVersion === 28) {
    const MORE_AFFIRMATIONS = [
      // Self-worth
      'I am worthy of love and respect, exactly as I am.',
      'My value doesn\'t depend on anyone else\'s approval.',
      'I treat myself with the same kindness I offer others.',
      'I am enough, even on the days that feel hard.',
      'I deserve good things, and I let myself receive them.',
      'I am proud of who I am becoming.',
      'My worth was never up for debate.',
      'I honor my needs without guilt.',
      'I am allowed to take up space.',
      'I like who I am when I stop comparing myself to others.',
      // Confidence
      'I trust my ability to figure things out.',
      'I speak up for myself with clarity and calm.',
      'I am capable of more than I give myself credit for.',
      'My voice matters, and I use it.',
      'I walk into new situations with quiet confidence.',
      'I don\'t need to be perfect to be proud of myself.',
      'I back myself, even when I\'m unsure.',
      'I am becoming more confident with every step I take.',
      'I trust the decisions I make for my own life.',
      'I stand tall in who I am.',
      // Calm & anxiety relief
      'I am safe in this moment.',
      'I can handle whatever comes next, one step at a time.',
      'My breath is steady, and so am I.',
      'This feeling is temporary — it will pass.',
      'I release what I cannot control.',
      'I choose peace over worry.',
      'I am allowed to slow down.',
      'Not everything needs to be figured out today.',
      'I give myself permission to rest.',
      'I trust that things will work out, even if I don\'t know how yet.',
      'I am grounded, even when things around me feel uncertain.',
      'I can be anxious and brave at the same time.',
      // Gratitude
      'I notice the good things, even the small ones.',
      'I am thankful for how far I\'ve come.',
      'There is always something to appreciate today.',
      'I choose to see what I have, not just what I lack.',
      'Gratitude turns what I have into enough.',
      'I am grateful for the people who show up for me.',
      'Today holds something worth being thankful for.',
      'I appreciate my body for carrying me through each day.',
      // Resilience & growth
      'Every challenge I\'ve faced has taught me something.',
      'I grow stronger every time I choose to keep going.',
      'Setbacks are not the end of my story.',
      'I am not defined by my mistakes — I learn from them.',
      'I have survived every hard day so far.',
      'I am capable of starting again, as many times as I need to.',
      'Difficult seasons don\'t last forever.',
      'I turn obstacles into lessons.',
      'I am always growing, even when it doesn\'t feel like it.',
      'My past does not decide my future.',
      'I am resilient, adaptable, and stronger than I think.',
      'Progress, not perfection, is enough.',
      // Focus & productivity
      'I can focus on one thing at a time.',
      'I give myself credit for what I finish, not just what\'s left.',
      'I do my best work when I trust the process.',
      'Small steps forward still count as progress.',
      'I am productive without needing to be busy every second.',
      'I finish what matters most first.',
      'Distractions don\'t control my day — I do.',
      'I am allowed to work at my own pace.',
      // Health & body
      'I listen to what my body needs.',
      'I am grateful for my body and how it supports me.',
      'Taking care of myself is not selfish.',
      'I move my body because I love it, not to punish it.',
      'I nourish myself with food, rest, and kindness.',
      'My body deserves care, not criticism.',
      'I am learning to be gentle with myself.',
      'Healing is not linear, and that\'s okay.',
      // Relationships
      'I attract people who respect and value me.',
      'I am open to giving and receiving love.',
      'I set boundaries that protect my peace.',
      'I choose relationships that lift me up.',
      'I communicate my needs with honesty and care.',
      'I forgive myself for relationships that didn\'t work out.',
      'I am a good friend to the people I care about.',
      'I deserve relationships built on mutual respect.',
      // Morning
      'Today is a fresh start.',
      'I choose how I want to show up today.',
      'This morning, I set the tone for a good day.',
      'I wake up with purpose.',
      'Today, I will do my best — and that is enough.',
      'I greet this day with an open mind.',
      'Whatever today brings, I am ready.',
      // Evening
      'I release today\'s stress before I sleep.',
      'I did enough today.',
      'Tomorrow is another chance to try again.',
      'I let go of what I couldn\'t control today.',
      'I am proud of how I showed up today, however it went.',
      'Rest is productive too.',
      'I close today with grace, not judgment.',
      // Letting go
      'I release what no longer serves me.',
      'I don\'t have to carry yesterday into today.',
      'Letting go is not giving up — it\'s making room.',
      'I forgive myself for what I didn\'t know back then.',
      'I am free from needing everyone\'s approval.',
      'I choose to move forward, not stay stuck.',
      'Some things are meant to be released, not fixed.',
      // Abundance & success
      'Opportunities are always finding their way to me.',
      'I am open to receiving abundance in all forms.',
      'Success looks different for everyone, and mine is valid.',
      'I am building the life I want, one day at a time.',
      'Money flows to me through effort and opportunity.',
      'I celebrate my wins, no matter how small.',
      'I am worthy of the success I\'m working toward.',
      'Good things are already on their way to me.',
      // Self-compassion
      'I would never speak to a friend the way I sometimes speak to myself.',
      'I am doing the best I can with what I know right now.',
      'I deserve patience, especially from myself.',
      'Mistakes don\'t make me a failure — they make me human.',
      'I choose self-compassion over self-criticism.',
      'I am allowed to have an off day.',
      'I am kind to myself, especially when things are hard.',
      // Courage
      'I can feel scared and do it anyway.',
      'Courage isn\'t the absence of fear — it\'s moving forward with it.',
      'I am brave enough to try, even without a guarantee.',
      'I choose growth over comfort.',
      'I am not afraid to ask for help.',
      'Every brave choice makes the next one easier.',
      'I trust myself to handle what\'s uncertain.',
      // Sleep & rest
      'My mind and body are ready to rest.',
      'I release today\'s thoughts and welcome quiet.',
      'Sleep restores me, and I welcome it.',
      'I am safe to relax completely.',
      'Tomorrow can wait until tomorrow.',
      'I let my body settle into calm.',
      // Purpose & direction
      'I am exactly where I need to be right now.',
      'My path doesn\'t have to look like anyone else\'s.',
      'I trust the timing of my life.',
      'I am allowed to change direction.',
      'Clarity comes with time — I don\'t need all the answers today.',
      'I am becoming the person I\'m meant to be.',
      'My journey is mine, and that\'s exactly right.',
      // Focus on the present
      'This moment is enough.',
      'I am here, right now, and that matters.',
      'I don\'t need to rush through today to get to tomorrow.',
      'I notice what\'s good, right in front of me.',
      'I am present for my own life.',
      // Strength in difficulty
      'I am stronger than the thing I\'m facing.',
      'I don\'t have to have it all figured out to keep going.',
      'This is hard, and I am still here.',
      'I give myself credit for showing up today.',
      'Even small progress is still progress.',
      'I am allowed to ask for support when I need it.',
      'I am not alone in what I\'m carrying.',
      // Confidence in change
      'Change is uncomfortable, but I can grow through it.',
      'I trust myself to adapt to whatever comes.',
      'New chapters require leaving old ones behind.',
      'I am capable of reinventing myself when I need to.',
      'Uncertainty doesn\'t mean I\'m doing something wrong.',
      // Joy & lightness
      'I let myself enjoy the good moments without guilt.',
      'Laughter is good for my soul.',
      'I make room for joy, even in busy seasons.',
      'I don\'t need a reason to feel good today.',
      'I am allowed to have fun.',
      'Small joys are still joys worth noticing.',
      // Creativity
      'My ideas are worth exploring.',
      'I don\'t need permission to create.',
      'There is no wrong way to express myself.',
      'I trust my creative instincts.',
      'Inspiration finds me when I stay curious.',
      'I make things because I enjoy making them, not to be perfect.',
      'My imagination is a strength, not a distraction.',
      // Work & career
      'I bring value wherever I show up.',
      'I am allowed to grow into a role, not just fit it perfectly on day one.',
      'My effort today is building something worthwhile.',
      'I can be ambitious and patient at the same time.',
      'Asking questions makes me better at what I do, not weaker.',
      'I don\'t have to prove my worth through overwork.',
      'My career is a path, not a race against anyone else.',
      'I am learning something new, even on hard days at work.',
      // Patience
      'Good things are allowed to take time.',
      'I don\'t need to rush the process to trust it.',
      'Patience with myself is a practice, not a personality trait.',
      'I can wait for the right moment without losing hope.',
      'Slow progress is still progress.',
      // Forgiveness of others
      'I can release resentment without excusing what happened.',
      'Forgiving others is something I do for my own peace.',
      'I choose not to carry other people\'s mistakes as my own weight.',
      'Letting go of anger makes room for something lighter.',
      // Body positivity
      'My body is not something I need to apologize for.',
      'I am more than how I look.',
      'My body has carried me through every day of my life so far.',
      'I choose respect over criticism when I think about my body.',
      'My worth isn\'t measured by a number on a scale.',
      // Motivation & discipline
      'Discipline is just choosing my future over my mood right now.',
      'I don\'t need to feel motivated to take the first step.',
      'Showing up matters more than showing up perfectly.',
      'Small consistent actions build the life I want.',
      'I keep promises to myself.',
      'Today\'s effort is tomorrow\'s progress.',
      // Hope
      'Better days are ahead, even if I can\'t see them yet.',
      'Hope doesn\'t require certainty.',
      'Things can change for me, even quickly.',
      'I choose to believe good things are still possible.',
      'This chapter isn\'t the whole story.',
      'Even small hope is enough to keep going.',
    ];

    const seededAt = new Date().toISOString();
    for (const text of MORE_AFFIRMATIONS) {
      const syncId = await deterministicSyncId('affirmation', text);
      await db.runAsync(
        'INSERT INTO affirmations (text, is_favorite, is_custom, created_at, updated_at, sync_id) VALUES (?, 0, 0, ?, ?, ?)',
        [text, seededAt, seededAt, syncId]
      );
    }

    currentDbVersion = 29;
    await db.execAsync(`PRAGMA user_version = 29`);
  }

  if (currentDbVersion === 29) {
    // `exercises` is a catalog table, not user data — refreshed by pulling from Firestore
    // (itself seeded from wger/ExerciseDB via scripts/), never pushed through the sync engine.
    // Seeding it here from the bundled JSON means a fresh install works fully offline; a
    // background Firestore pull (see modules/workout/useExerciseCatalogSync.ts) then upserts
    // any additions/updates over top, keyed on `key`, without ever touching a user's own data.
    await db.execAsync(`
      CREATE TABLE exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        muscles TEXT NOT NULL DEFAULT '[]',
        muscles_secondary TEXT NOT NULL DEFAULT '[]',
        equipment TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL DEFAULT '',
        image_url TEXT,
        gif_url TEXT,
        video_url TEXT,
        source TEXT NOT NULL DEFAULT 'bundled',
        source_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE INDEX idx_exercises_category ON exercises(category);

      CREATE TABLE programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        goal TEXT NOT NULL DEFAULT 'general',
        equipment TEXT NOT NULL DEFAULT 'none',
        weeks INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'bundled',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE program_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_key TEXT NOT NULL,
        day_key TEXT NOT NULL,
        title TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE(program_key, day_key)
      );
      CREATE INDEX idx_program_days_program ON program_days(program_key);

      CREATE TABLE program_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_key TEXT NOT NULL,
        day_key TEXT NOT NULL,
        exercise_key TEXT NOT NULL,
        sets INTEGER NOT NULL DEFAULT 3,
        reps INTEGER NOT NULL DEFAULT 10,
        note TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_program_exercises_program_day ON program_exercises(program_key, day_key);

      -- Real user data (which program/day a user is on, what they've completed) — unlike the
      -- catalog tables above, these DO go through the normal sync_id/pushLocalRow path.
      CREATE TABLE routine_progress (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        program_key TEXT,
        day_index INTEGER NOT NULL DEFAULT 0,
        week_number INTEGER NOT NULL DEFAULT 1,
        started_at TEXT,
        updated_at TEXT,
        sync_id TEXT
      );

      CREATE TABLE routine_day_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_key TEXT NOT NULL,
        day_key TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        completed_at TEXT NOT NULL,
        duration_seconds INTEGER,
        sync_id TEXT,
        updated_at TEXT
      );
      CREATE INDEX idx_routine_day_logs_program ON routine_day_logs(program_key);
    `);

    const exerciseSeededAt = new Date().toISOString();
    for (const exercise of bundledExercises as Array<{
      key: string;
      name: string;
      category: string;
      muscles: string[];
      musclesSecondary: string[];
      equipment: string[];
      description: string;
      imageUrl: string | null;
    }>) {
      await db.runAsync(
        `INSERT INTO exercises (key, name, category, muscles, muscles_secondary, equipment, description, image_url, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [
          exercise.key,
          exercise.name,
          exercise.category,
          JSON.stringify(exercise.muscles),
          JSON.stringify(exercise.musclesSecondary),
          JSON.stringify(exercise.equipment),
          exercise.description,
          exercise.imageUrl,
          exerciseSeededAt,
          exerciseSeededAt,
        ]
      );
    }

    // Two starter programs so "Suggested Routines" isn't empty on a fresh install — every
    // exercise_key below is a real, verified key from the bundled library seeded just above.
    const STARTER_PROGRAMS: Array<{
      key: string;
      title: string;
      description: string;
      goal: string;
      equipment: string;
      weeks: number;
      days: Array<{ key: string; title: string; exercises: Array<{ exerciseKey: string; sets: number; reps: number; note?: string }> }>;
    }> = [
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
    ];

    const programSeededAt = new Date().toISOString();
    for (const program of STARTER_PROGRAMS) {
      await db.runAsync(
        `INSERT INTO programs (key, title, description, goal, equipment, weeks, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [program.key, program.title, program.description, program.goal, program.equipment, program.weeks, programSeededAt, programSeededAt]
      );
      for (const [dayIndex, day] of program.days.entries()) {
        await db.runAsync(`INSERT INTO program_days (program_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)`, [
          program.key,
          day.key,
          day.title,
          dayIndex,
        ]);
        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          await db.runAsync(
            `INSERT INTO program_exercises (program_key, day_key, exercise_key, sets, reps, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [program.key, day.key, exercise.exerciseKey, exercise.sets, exercise.reps, exercise.note ?? null, exerciseIndex]
          );
        }
      }
    }

    currentDbVersion = 30;
    await db.execAsync(`PRAGMA user_version = 30`);
  }

  if (currentDbVersion === 30) {
    // More goal-tagged workout programs, added the same way as the two v30 starter programs —
    // straight INSERTs into the tables v30 already created, no new workout tables needed.
    // 'weight-gain' and 'muscle-building' intentionally share one goal tag: the training
    // approach (progressive overload, compound lifts) is the same; only nutrition differs.
    const MORE_PROGRAMS: Array<{
      key: string;
      title: string;
      description: string;
      goal: string;
      equipment: string;
      weeks: number;
      days: Array<{ key: string; title: string; exercises: Array<{ exerciseKey: string; sets: number; reps: number; note?: string }> }>;
    }> = [
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
    ];

    const moreProgramsSeededAt = new Date().toISOString();
    for (const program of MORE_PROGRAMS) {
      await db.runAsync(
        `INSERT INTO programs (key, title, description, goal, equipment, weeks, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [program.key, program.title, program.description, program.goal, program.equipment, program.weeks, moreProgramsSeededAt, moreProgramsSeededAt]
      );
      for (const [dayIndex, day] of program.days.entries()) {
        await db.runAsync(`INSERT INTO program_days (program_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)`, [
          program.key,
          day.key,
          day.title,
          dayIndex,
        ]);
        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          await db.runAsync(
            `INSERT INTO program_exercises (program_key, day_key, exercise_key, sets, reps, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [program.key, day.key, exercise.exerciseKey, exercise.sets, exercise.reps, exercise.note ?? null, exerciseIndex]
          );
        }
      }
    }

    // Meal plans — same catalog pattern as programs, but for the Food module. `dish_name` matches
    // names already searchable in modules/food (searchIndianFoods) rather than a foreign key, since
    // the food dataset has no stable per-dish key yet; nutrition is captured directly on each item
    // rather than joined at read time. `budget_tier` and calories are informational tags, not a
    // real ₹ price — no verified per-dish cost data exists to back a specific number.
    await db.execAsync(`
      CREATE TABLE meal_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        goal TEXT NOT NULL DEFAULT 'general',
        budget_tier TEXT NOT NULL DEFAULT 'budget',
        diet TEXT NOT NULL DEFAULT 'veg',
        daily_calories_target INTEGER,
        source TEXT NOT NULL DEFAULT 'bundled',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE meal_plan_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_key TEXT NOT NULL,
        day_key TEXT NOT NULL,
        title TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE(plan_key, day_key)
      );
      CREATE INDEX idx_meal_plan_days_plan ON meal_plan_days(plan_key);

      CREATE TABLE meal_plan_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_key TEXT NOT NULL,
        day_key TEXT NOT NULL,
        meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
        dish_name TEXT NOT NULL,
        calories INTEGER,
        protein_g INTEGER,
        carbs_g INTEGER,
        fat_g INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_meal_plan_items_plan_day ON meal_plan_items(plan_key, day_key);
    `);

    const MEAL_PLANS: Array<{
      key: string;
      title: string;
      description: string;
      goal: string;
      budgetTier: string;
      diet: string;
      dailyCaloriesTarget: number;
      days: Array<{
        key: string;
        title: string;
        items: Array<{ meal: string; dishName: string; calories: number; protein: number; carbs: number; fat: number }>;
      }>;
    }> = [
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
              { meal: 'breakfast', dishName: 'Idli (2 pieces) + Sambar + Filter Coffee', calories: 258, protein: 10, carbs: 44, fat: 3 },
              { meal: 'lunch', dishName: 'Dal Tadka + Steamed Rice + Bhindi Masala + Plain Curd', calories: 590, protein: 22, carbs: 82, fat: 16 },
              { meal: 'snack', dishName: 'Buttermilk (Chaas)', calories: 40, protein: 3, carbs: 4, fat: 1 },
              { meal: 'dinner', dishName: 'Moong Dal + Roti (2 pieces) + Mixed Vegetable Curry', calories: 472, protein: 20, carbs: 61, fat: 15 },
            ],
          },
          {
            key: 'day-2',
            title: 'Day 2',
            items: [
              { meal: 'breakfast', dishName: 'Plain Dosa (2 pieces) + Coconut Chutney + Filter Coffee', calories: 332, protein: 8, carbs: 51, fat: 8 },
              { meal: 'lunch', dishName: 'Sambar + Steamed Rice + Aloo Gobi + Plain Curd', calories: 580, protein: 19, carbs: 85, fat: 16 },
              { meal: 'snack', dishName: 'Coconut Water', calories: 45, protein: 0.5, carbs: 9, fat: 0.2 },
              { meal: 'dinner', dishName: 'Rasam + Roti (2 pieces) + Chana Masala', calories: 412, protein: 15, carbs: 55, fat: 12 },
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
              { meal: 'breakfast', dishName: 'Egg Bhurji (2 eggs) + Roti + Filter Coffee', calories: 351, protein: 18, carbs: 25, fat: 21 },
              { meal: 'lunch', dishName: 'Fish Curry + Steamed Rice + Rasam', calories: 480, protein: 24, carbs: 54, fat: 14 },
              { meal: 'snack', dishName: 'Buttermilk (Chaas)', calories: 40, protein: 3, carbs: 4, fat: 1 },
              { meal: 'dinner', dishName: 'Chicken Curry + Roti (2 pieces)', calories: 422, protein: 28, carbs: 22, fat: 19 },
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
              { meal: 'breakfast', dishName: 'Paneer Paratha (2 pieces) + Plain Curd + Badam Milk', calories: 760, protein: 28, carbs: 72, fat: 34 },
              { meal: 'lunch', dishName: 'Rajma + Steamed Rice (1.5 cups) + Palak Paneer + Raita', calories: 860, protein: 36, carbs: 92, fat: 34 },
              { meal: 'snack', dishName: 'Sweet Lassi + Besan Ladoo', calories: 400, protein: 9, carbs: 50, fat: 17 },
              { meal: 'dinner', dishName: 'Dal Makhani + Roti (3 pieces) + Matar Paneer', calories: 773, protein: 32, carbs: 74, fat: 38 },
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
              { meal: 'breakfast', dishName: 'Egg Curry (2 eggs) + Paratha (2 pieces) + Badam Milk', calories: 712, protein: 30, carbs: 66, fat: 32 },
              { meal: 'lunch', dishName: 'Chicken Tikka Masala + Steamed Rice (1.5 cups) + Dal Tadka + Plain Curd', calories: 880, protein: 46, carbs: 82, fat: 33 },
              { meal: 'snack', dishName: 'Sweet Lassi + Banana Chips', calories: 480, protein: 7, carbs: 60, fat: 21 },
              { meal: 'dinner', dishName: 'Butter Chicken + Naan (2 pieces)', calories: 874, protein: 42, carbs: 55, fat: 42 },
            ],
          },
        ],
      },
    ];

    const mealPlanSeededAt = new Date().toISOString();
    for (const plan of MEAL_PLANS) {
      await db.runAsync(
        `INSERT INTO meal_plans (key, title, description, goal, budget_tier, diet, daily_calories_target, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [
          plan.key,
          plan.title,
          plan.description,
          plan.goal,
          plan.budgetTier,
          plan.diet,
          plan.dailyCaloriesTarget,
          mealPlanSeededAt,
          mealPlanSeededAt,
        ]
      );
      for (const [dayIndex, day] of plan.days.entries()) {
        await db.runAsync(`INSERT INTO meal_plan_days (plan_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)`, [
          plan.key,
          day.key,
          day.title,
          dayIndex,
        ]);
        for (const [itemIndex, item] of day.items.entries()) {
          await db.runAsync(
            `INSERT INTO meal_plan_items (plan_key, day_key, meal, dish_name, calories, protein_g, carbs_g, fat_g, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [plan.key, day.key, item.meal, item.dishName, item.calories, item.protein, item.carbs, item.fat, itemIndex]
          );
        }
      }
    }

    currentDbVersion = 31;
    await db.execAsync(`PRAGMA user_version = 31`);
  }

  if (currentDbVersion === 31) {
    // More goal-coverage: a no-equipment quick option for weight-loss, a dumbbell-only (not
    // full-gym) beginner option for muscle-building, and 'maintain'-goal meal plans — rounding
    // out coverage for every HealthGoal value (modules/onboarding/types.ts) the recommendation
    // logic in usePrograms/useMealPlans matches against.
    const MORE_PROGRAMS_V32: Array<{
      key: string;
      title: string;
      description: string;
      goal: string;
      equipment: string;
      weeks: number;
      days: Array<{ key: string; title: string; exercises: Array<{ exerciseKey: string; sets: number; reps: number; note?: string }> }>;
    }> = [
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
    ];

    const moreProgramsV32SeededAt = new Date().toISOString();
    for (const program of MORE_PROGRAMS_V32) {
      await db.runAsync(
        `INSERT INTO programs (key, title, description, goal, equipment, weeks, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [program.key, program.title, program.description, program.goal, program.equipment, program.weeks, moreProgramsV32SeededAt, moreProgramsV32SeededAt]
      );
      for (const [dayIndex, day] of program.days.entries()) {
        await db.runAsync(`INSERT INTO program_days (program_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)`, [
          program.key,
          day.key,
          day.title,
          dayIndex,
        ]);
        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          await db.runAsync(
            `INSERT INTO program_exercises (program_key, day_key, exercise_key, sets, reps, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [program.key, day.key, exercise.exerciseKey, exercise.sets, exercise.reps, exercise.note ?? null, exerciseIndex]
          );
        }
      }
    }

    const MORE_MEAL_PLANS_V32: Array<{
      key: string;
      title: string;
      description: string;
      goal: string;
      budgetTier: string;
      diet: string;
      dailyCaloriesTarget: number;
      days: Array<{
        key: string;
        title: string;
        items: Array<{ meal: string; dishName: string; calories: number; protein: number; carbs: number; fat: number }>;
      }>;
    }> = [
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
              { meal: 'breakfast', dishName: 'Masala Dosa + Filter Coffee', calories: 310, protein: 7, carbs: 48, fat: 10 },
              { meal: 'lunch', dishName: 'Dal Tadka + Steamed Rice (1.5 cups) + Aloo Matar + Plain Curd', calories: 730, protein: 24, carbs: 96, fat: 21 },
              { meal: 'snack', dishName: 'Sweet Lassi', calories: 220, protein: 6, carbs: 30, fat: 8 },
              { meal: 'dinner', dishName: 'Sambar + Roti (3 pieces) + Mixed Vegetable Curry', calories: 523, protein: 14, carbs: 59, fat: 20 },
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
              { meal: 'breakfast', dishName: 'Egg Bhurji (2 eggs) + Roti + Filter Coffee', calories: 351, protein: 18, carbs: 25, fat: 21 },
              { meal: 'lunch', dishName: 'Chicken Curry + Steamed Rice (1.5 cups) + Dal Tadka', calories: 730, protein: 32, carbs: 78, fat: 26 },
              { meal: 'snack', dishName: 'Buttermilk (Chaas) + Murukku', calories: 220, protein: 6, carbs: 22, fat: 12 },
              { meal: 'dinner', dishName: 'Fish Fry + Roti (2 pieces) + Sambar', calories: 462, protein: 26, carbs: 34, fat: 22 },
            ],
          },
        ],
      },
    ];

    const mealPlansV32SeededAt = new Date().toISOString();
    for (const plan of MORE_MEAL_PLANS_V32) {
      await db.runAsync(
        `INSERT INTO meal_plans (key, title, description, goal, budget_tier, diet, daily_calories_target, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [plan.key, plan.title, plan.description, plan.goal, plan.budgetTier, plan.diet, plan.dailyCaloriesTarget, mealPlansV32SeededAt, mealPlansV32SeededAt]
      );
      for (const [dayIndex, day] of plan.days.entries()) {
        await db.runAsync(`INSERT INTO meal_plan_days (plan_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)`, [
          plan.key,
          day.key,
          day.title,
          dayIndex,
        ]);
        for (const [itemIndex, item] of day.items.entries()) {
          await db.runAsync(
            `INSERT INTO meal_plan_items (plan_key, day_key, meal, dish_name, calories, protein_g, carbs_g, fat_g, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [plan.key, day.key, item.meal, item.dishName, item.calories, item.protein, item.carbs, item.fat, itemIndex]
          );
        }
      }
    }

    currentDbVersion = 32;
    await db.execAsync(`PRAGMA user_version = 32`);
  }

  if (currentDbVersion === 32) {
    // More days for the meal plans that only had one — appends new rows to the existing v31/v32
    // meal_plan_days/meal_plan_items tables for EXISTING plan keys, doesn't create new plans.
    const EXTRA_DAYS: Array<{
      planKey: string;
      dayKey: string;
      title: string;
      items: Array<{ meal: string; dishName: string; calories: number; protein: number; carbs: number; fat: number }>;
    }> = [
      {
        planKey: 'budget-weight-loss-nonveg',
        dayKey: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Egg Curry (2 eggs) + Rumali Roti + Filter Coffee', calories: 400, protein: 19, carbs: 31, fat: 22 },
          { meal: 'lunch', dishName: 'Prawn Curry + Steamed Rice + Rasam', calories: 500, protein: 26, carbs: 63, fat: 15 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas)', calories: 40, protein: 3, carbs: 4, fat: 1 },
          { meal: 'dinner', dishName: 'Tandoori Chicken + Roti (2 pieces)', calories: 362, protein: 34, carbs: 33, fat: 11 },
        ],
      },
      {
        planKey: 'muscle-building-veg',
        dayKey: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Pesarattu + Peanut Chutney + Badam Milk', calories: 430, protein: 16, carbs: 50, fat: 18 },
          { meal: 'lunch', dishName: 'Chana Masala + Steamed Rice (1.5 cups) + Shahi Paneer + Raita', calories: 920, protein: 33, carbs: 120, fat: 35 },
          { meal: 'snack', dishName: 'Kheer + Coconut Ladoo', calories: 360, protein: 8, carbs: 46, fat: 16 },
          { meal: 'dinner', dishName: 'Rajma + Roti (3 pieces) + Palak Paneer', calories: 683, protein: 32, carbs: 92, fat: 24 },
        ],
      },
      {
        planKey: 'muscle-building-nonveg',
        dayKey: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Chicken Kebab + Naan + Badam Milk', calories: 702, protein: 38, carbs: 73, fat: 28 },
          { meal: 'lunch', dishName: 'Mutton Rogan Josh + Steamed Rice (1.5 cups) + Dal Tadka', calories: 790, protein: 40, carbs: 96, fat: 29 },
          { meal: 'snack', dishName: 'Sweet Lassi + Peda', calories: 310, protein: 8, carbs: 40, fat: 12 },
          { meal: 'dinner', dishName: 'Chicken Chettinad + Roti (2 pieces)', calories: 442, protein: 30, carbs: 38, fat: 21 },
        ],
      },
      {
        planKey: 'balanced-maintenance-veg',
        dayKey: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Idli (2 pieces) + Sambar + Filter Coffee', calories: 258, protein: 10, carbs: 44, fat: 3 },
          { meal: 'lunch', dishName: 'Sambar + Steamed Rice + Aloo Gobi + Plain Curd', calories: 580, protein: 19, carbs: 85, fat: 16 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas) + Dhokla', calories: 170, protein: 7, carbs: 24, fat: 4 },
          { meal: 'dinner', dishName: 'Moong Dal + Roti (2 pieces) + Bhindi Masala', calories: 422, protein: 16, carbs: 47, fat: 11 },
        ],
      },
      {
        planKey: 'balanced-maintenance-nonveg',
        dayKey: 'day-2',
        title: 'Day 2',
        items: [
          { meal: 'breakfast', dishName: 'Chicken Frankie + Filter Coffee', calories: 380, protein: 18, carbs: 43, fat: 16 },
          { meal: 'lunch', dishName: 'Fish Curry + Steamed Rice + Sambar', calories: 540, protein: 30, carbs: 69, fat: 16 },
          { meal: 'snack', dishName: 'Buttermilk (Chaas)', calories: 40, protein: 3, carbs: 4, fat: 1 },
          { meal: 'dinner', dishName: 'Egg Curry (2 eggs) + Roti (2 pieces)', calories: 402, protein: 20, carbs: 38, fat: 20 },
        ],
      },
      {
        planKey: 'budget-weight-loss-veg',
        dayKey: 'day-3',
        title: 'Day 3',
        items: [
          { meal: 'breakfast', dishName: 'Upma + Filter Coffee', calories: 255, protein: 6, carbs: 38, fat: 9 },
          { meal: 'lunch', dishName: 'Moong Dal + Steamed Rice + Bhindi Masala + Plain Curd', calories: 570, protein: 24, carbs: 79, fat: 15 },
          { meal: 'snack', dishName: 'Coconut Water', calories: 45, protein: 0.5, carbs: 9, fat: 0.2 },
          { meal: 'dinner', dishName: 'Sambar + Roti (2 pieces) + Aloo Matar', calories: 442, protein: 15, carbs: 55, fat: 12 },
        ],
      },
    ];

    // day sort_order continues after whatever's already there for that plan (day-1=0, day-2=1
    // for plans gaining their 2nd day; day-3=2 for the one gaining a 3rd), so ordering stays
    // correct without needing to know how many days a plan already had.
    const DAY_SORT_ORDER: Record<string, number> = { 'day-2': 1, 'day-3': 2 };
    const extraDaysSeededAt = new Date().toISOString();
    for (const day of EXTRA_DAYS) {
      await db.runAsync('INSERT INTO meal_plan_days (plan_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)', [
        day.planKey,
        day.dayKey,
        day.title,
        DAY_SORT_ORDER[day.dayKey] ?? 1,
      ]);
      for (const [itemIndex, item] of day.items.entries()) {
        await db.runAsync(
          `INSERT INTO meal_plan_items (plan_key, day_key, meal, dish_name, calories, protein_g, carbs_g, fat_g, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [day.planKey, day.dayKey, item.meal, item.dishName, item.calories, item.protein, item.carbs, item.fat, itemIndex]
        );
      }
    }
    // Touch updated_at on affected plans so a future Firestore diff/sync pass has a signal that
    // something about them changed.
    for (const planKey of new Set(EXTRA_DAYS.map((d) => d.planKey))) {
      await db.runAsync('UPDATE meal_plans SET updated_at = ? WHERE key = ?', [extraDaysSeededAt, planKey]);
    }

    currentDbVersion = 33;
    await db.execAsync(`PRAGMA user_version = 33`);
  }

  if (currentDbVersion === 33) {
    const MORE_PROGRAMS_V34: Array<{
      key: string;
      title: string;
      description: string;
      goal: string;
      equipment: string;
      weeks: number;
      days: Array<{ key: string; title: string; exercises: Array<{ exerciseKey: string; sets: number; reps: number; note?: string }> }>;
    }> = [
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
    ];

    const moreProgramsV34SeededAt = new Date().toISOString();
    for (const program of MORE_PROGRAMS_V34) {
      await db.runAsync(
        `INSERT INTO programs (key, title, description, goal, equipment, weeks, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [program.key, program.title, program.description, program.goal, program.equipment, program.weeks, moreProgramsV34SeededAt, moreProgramsV34SeededAt]
      );
      for (const [dayIndex, day] of program.days.entries()) {
        await db.runAsync(`INSERT INTO program_days (program_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)`, [
          program.key,
          day.key,
          day.title,
          dayIndex,
        ]);
        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          await db.runAsync(
            `INSERT INTO program_exercises (program_key, day_key, exercise_key, sets, reps, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [program.key, day.key, exercise.exerciseKey, exercise.sets, exercise.reps, exercise.note ?? null, exerciseIndex]
          );
        }
      }
    }

    currentDbVersion = 34;
    await db.execAsync(`PRAGMA user_version = 34`);
  }

  if (currentDbVersion === 34) {
    // A calisthenics tier (bodyweight-only, no equipment) plus two gentle "goal: recovery"
    // routines — low-intensity movement for period discomfort or general stiffness. These are
    // explicitly NOT medical advice (see each description); goal:'recovery' is a new tag so they
    // never get surfaced as "Recommended for you" against a weight-loss/muscle-building health
    // goal — they're an always-available comfort option, not a fitness-goal match.
    const MORE_PROGRAMS_V35: Array<{
      key: string;
      title: string;
      description: string;
      goal: string;
      equipment: string;
      weeks: number;
      days: Array<{ key: string; title: string; exercises: Array<{ exerciseKey: string; sets: number; reps: number; note?: string }> }>;
    }> = [
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
    ];

    const moreProgramsV35SeededAt = new Date().toISOString();
    for (const program of MORE_PROGRAMS_V35) {
      await db.runAsync(
        `INSERT INTO programs (key, title, description, goal, equipment, weeks, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [program.key, program.title, program.description, program.goal, program.equipment, program.weeks, moreProgramsV35SeededAt, moreProgramsV35SeededAt]
      );
      for (const [dayIndex, day] of program.days.entries()) {
        await db.runAsync(`INSERT INTO program_days (program_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)`, [
          program.key,
          day.key,
          day.title,
          dayIndex,
        ]);
        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          await db.runAsync(
            `INSERT INTO program_exercises (program_key, day_key, exercise_key, sets, reps, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [program.key, day.key, exercise.exerciseKey, exercise.sets, exercise.reps, exercise.note ?? null, exerciseIndex]
          );
        }
      }
    }

    currentDbVersion = 35;
    await db.execAsync(`PRAGMA user_version = 35`);
  }

  if (currentDbVersion === 35) {
    // Warm-up/cool-down are no longer auto-bookended into every workout session (removed from
    // both session players) — preserved instead as their own standalone, pickable programs, same
    // exercises that used to live in the now-deleted modules/workout/warmup.ts.
    const MORE_PROGRAMS_V36: Array<{
      key: string;
      title: string;
      description: string;
      goal: string;
      equipment: string;
      weeks: number;
      days: Array<{ key: string; title: string; exercises: Array<{ exerciseKey: string; sets: number; reps: number; note?: string }> }>;
    }> = [
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

    const moreProgramsV36SeededAt = new Date().toISOString();
    for (const program of MORE_PROGRAMS_V36) {
      await db.runAsync(
        `INSERT INTO programs (key, title, description, goal, equipment, weeks, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
        [program.key, program.title, program.description, program.goal, program.equipment, program.weeks, moreProgramsV36SeededAt, moreProgramsV36SeededAt]
      );
      for (const [dayIndex, day] of program.days.entries()) {
        await db.runAsync(`INSERT INTO program_days (program_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)`, [
          program.key,
          day.key,
          day.title,
          dayIndex,
        ]);
        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          await db.runAsync(
            `INSERT INTO program_exercises (program_key, day_key, exercise_key, sets, reps, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [program.key, day.key, exercise.exerciseKey, exercise.sets, exercise.reps, exercise.note ?? null, exerciseIndex]
          );
        }
      }
    }

    currentDbVersion = 36;
    await db.execAsync(`PRAGMA user_version = 36`);
  }

  if (currentDbVersion === 36) {
    // Module reminders gain a third schedule type: 'hourly', firing once an hour within a
    // start–end window (e.g. hydration nudges from 8 AM to 9 PM) rather than once a day.
    await db.execAsync('ALTER TABLE module_reminders ADD COLUMN hourly_start TEXT');
    await db.execAsync('ALTER TABLE module_reminders ADD COLUMN hourly_end TEXT');

    currentDbVersion = 37;
    await db.execAsync(`PRAGMA user_version = 37`);
  }

  if (currentDbVersion === 37) {
    // Habits gain multiple reminder times per day (e.g. 8am AND 2pm AND 9pm) instead of just one.
    // Reusing `habits.reminder_time` rather than adding a new column/table — it now holds a JSON
    // array of "HH:MM" strings instead of a single one. Existing single-time values (a plain
    // "HH:MM" string, never JSON) are wrapped into a one-element array so nobody's existing
    // reminder silently vanishes. "HH:MM" can never contain a `"` or `\`, so this plain string
    // concat is a safe way to build the JSON array literal.
    await db.execAsync(`
      UPDATE habits SET reminder_time = '["' || reminder_time || '"]'
      WHERE reminder_time IS NOT NULL AND reminder_time NOT LIKE '[%';
    `);

    currentDbVersion = 38;
    await db.execAsync(`PRAGMA user_version = 38`);
  }

  if (currentDbVersion === 38) {
    // Financial goal becomes multi-select (health goal stays single-select — it's still
    // one-at-a-time). The old single-value `financial_goal` column is replaced by
    // `financial_goals`, a JSON-encoded array in a TEXT column — the same array-in-TEXT
    // convention already used by habits.target_days and module_reminders.schedule_days. The old
    // column is left in place (unused) rather than dropped, since dropping/rebuilding this table
    // isn't needed just to free one TEXT column.
    await db.execAsync("ALTER TABLE user_details ADD COLUMN financial_goals TEXT NOT NULL DEFAULT '[]'");

    const rows = await db.getAllAsync<{ id: number; financial_goal: string | null }>(
      'SELECT id, financial_goal FROM user_details'
    );
    for (const row of rows) {
      if (row.financial_goal) {
        await db.runAsync('UPDATE user_details SET financial_goals = ? WHERE id = ?', [JSON.stringify([row.financial_goal]), row.id]);
      }
    }

    currentDbVersion = 39;
    await db.execAsync(`PRAGMA user_version = 39`);
  }

  if (currentDbVersion === 39) {
    // Opt-in menstrual cycle tracking — off by default (see cycle_preferences.tracking_enabled),
    // never shown anywhere unless the user turns it on themselves. `flow` and `symptoms` are only
    // set on days something was actually logged; a day with no row just means "nothing logged,"
    // same convention as journal_checkins.
    await db.execAsync(`
      CREATE TABLE cycle_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        tracking_enabled INTEGER NOT NULL DEFAULT 0,
        average_cycle_length INTEGER NOT NULL DEFAULT 28,
        average_period_length INTEGER NOT NULL DEFAULT 5,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE cycle_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        flow TEXT,
        symptoms TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT,
        UNIQUE(date)
      );
      CREATE INDEX idx_cycle_logs_date ON cycle_logs(date);
      CREATE INDEX idx_cycle_logs_sync_id ON cycle_logs(sync_id);
    `);
    await db.runAsync(
      'INSERT INTO cycle_preferences (id, tracking_enabled, average_cycle_length, average_period_length, updated_at) VALUES (1, 0, 28, 5, ?)',
      [new Date().toISOString()]
    );

    currentDbVersion = 40;
    await db.execAsync(`PRAGMA user_version = 40`);
  }

  if (currentDbVersion === 40) {
    // Cardio & More: Running/Walking/Hiking log distance + duration (speed is derived, never
    // stored); Yoga/Sports log duration only (distance_km stays NULL). `cardio_activities` is a
    // fixed 5-row table (one per activity, upserted — not user-creatable) holding just the
    // optional recurring-schedule prefs, mirroring `habits`' own frequency/target_days shape
    // rather than reusing the task recurrence engine, since these aren't tasks.
    await db.execAsync(`
      CREATE TABLE cardio_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity TEXT NOT NULL UNIQUE CHECK (activity IN ('running', 'walking', 'hiking', 'yoga', 'sports')),
        is_recurring INTEGER NOT NULL DEFAULT 0,
        frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
        target_days TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_cardio_activities_sync_id ON cardio_activities(sync_id);

      CREATE TABLE cardio_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity TEXT NOT NULL CHECK (activity IN ('running', 'walking', 'hiking', 'yoga', 'sports')),
        date TEXT NOT NULL,
        distance_km REAL,
        duration_minutes INTEGER NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_cardio_logs_date ON cardio_logs(date);
      CREATE INDEX idx_cardio_logs_activity ON cardio_logs(activity);
      CREATE INDEX idx_cardio_logs_sync_id ON cardio_logs(sync_id);
    `);

    currentDbVersion = 41;
    await db.execAsync(`PRAGMA user_version = 41`);
  }

  if (currentDbVersion === 41) {
    // Sports/Yoga gain a "what specifically" picklist value (a sport name or a yoga pose —
    // one column covers both, it's the same question either way), and every activity gains an
    // optional intensity level. Nullable ADD COLUMNs — SQLite can't retrofit a CHECK constraint
    // onto an existing table without a full rebuild, so these stay unconstrained at the DB layer;
    // the app only ever writes the fixed picklist values from modules/cardio/types.ts.
    await db.execAsync(`
      ALTER TABLE cardio_logs ADD COLUMN sport_name TEXT;
      ALTER TABLE cardio_logs ADD COLUMN intensity TEXT;
    `);

    currentDbVersion = 42;
    await db.execAsync(`PRAGMA user_version = 42`);
  }

  if (currentDbVersion === 42) {
    // Cycling (distance-based, GPS-recordable like running/walking/hiking) and Swimming
    // (session-based like yoga/sports) join the activity list. SQLite can't widen an existing
    // CHECK constraint in place, so both cardio tables are rebuilt with the new constraint and
    // their data copied across — same rename-swap pattern as any other constrained-column
    // migration, just done here instead of left unconstrained since these ARE the constrained
    // columns themselves (unlike sport_name/intensity above, which were new columns).
    await db.execAsync(`
      CREATE TABLE cardio_activities_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity TEXT NOT NULL UNIQUE CHECK (activity IN ('running', 'walking', 'hiking', 'cycling', 'swimming', 'yoga', 'sports')),
        is_recurring INTEGER NOT NULL DEFAULT 0,
        frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
        target_days TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      INSERT INTO cardio_activities_new SELECT * FROM cardio_activities;
      DROP TABLE cardio_activities;
      ALTER TABLE cardio_activities_new RENAME TO cardio_activities;
      CREATE INDEX idx_cardio_activities_sync_id ON cardio_activities(sync_id);

      CREATE TABLE cardio_logs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity TEXT NOT NULL CHECK (activity IN ('running', 'walking', 'hiking', 'cycling', 'swimming', 'yoga', 'sports')),
        date TEXT NOT NULL,
        distance_km REAL,
        duration_minutes INTEGER NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT,
        sport_name TEXT,
        intensity TEXT
      );
      INSERT INTO cardio_logs_new SELECT * FROM cardio_logs;
      DROP TABLE cardio_logs;
      ALTER TABLE cardio_logs_new RENAME TO cardio_logs;
      CREATE INDEX idx_cardio_logs_date ON cardio_logs(date);
      CREATE INDEX idx_cardio_logs_activity ON cardio_logs(activity);
      CREATE INDEX idx_cardio_logs_sync_id ON cardio_logs(sync_id);
    `);

    currentDbVersion = 43;
    await db.execAsync(`PRAGMA user_version = 43`);
  }

  if (currentDbVersion === 43) {
    // Gender — asked once during onboarding, used only to decide whether Cycle Tracking's nav
    // entry should show (see modules/cycle's shouldShowCycleTracking). Nullable: anyone who
    // hasn't answered yet keeps seeing Cycle Tracking as before, same as before this column
    // existed — it only hides once someone explicitly sets a non-female gender.
    await db.execAsync(`ALTER TABLE user_profile ADD COLUMN gender TEXT`);

    currentDbVersion = 44;
    await db.execAsync(`PRAGMA user_version = 44`);
  }

  if (currentDbVersion === 44) {
    // The onboarding form's new Personal/Fitness pages — country/state (Personal), and average
    // sleep/wake time + average water intake + food style (Fitness). All nullable and additive to
    // the existing `user_details` singleton, same reasoning as every other onboarding field: this
    // is optional, skippable profile data that syncs across devices like the rest of the row.
    await db.execAsync(`
      ALTER TABLE user_details ADD COLUMN country TEXT;
      ALTER TABLE user_details ADD COLUMN state TEXT;
      ALTER TABLE user_details ADD COLUMN avg_sleep_time TEXT;
      ALTER TABLE user_details ADD COLUMN avg_wake_time TEXT;
      ALTER TABLE user_details ADD COLUMN avg_water_intake_ml INTEGER;
      ALTER TABLE user_details ADD COLUMN food_style TEXT;
    `);

    currentDbVersion = 45;
    await db.execAsync(`PRAGMA user_version = 45`);
  }

  if (currentDbVersion === 45) {
    // Shopping items previously stored quantity as pure free text ("25 kg", "500 g") multiplied
    // straight into price — meaning a price meant "per piece" for a "2 kg" item silently computed
    // a total as if 2 whole units were bought, not 2 kilograms. `unit` lets price mean "per kg" /
    // "per L" / "per piece" explicitly, so a weight/volume line total can be unit-converted instead
    // of just multiplying the raw quantity number (see modules/shopping/quantity.ts). Defaults to
    // 'pcs' so every existing row keeps computing exactly as it did before this column existed.
    await db.execAsync(`ALTER TABLE shopping_items ADD COLUMN unit TEXT NOT NULL DEFAULT 'pcs'`);

    currentDbVersion = 46;
    await db.execAsync(`PRAGMA user_version = 46`);
  }

  if (currentDbVersion === 46) {
    // A free-text notes field per item — brand, size preference, "get the ripe ones", etc.
    await db.execAsync(`ALTER TABLE shopping_items ADD COLUMN notes TEXT`);

    currentDbVersion = 47;
    await db.execAsync(`PRAGMA user_version = 47`);
  }

  if (currentDbVersion === 47) {
    // Persists the route drawn during a GPS-recorded session (route_points, JSON-serialized
    // RoutePoint[]) plus the two fields collected on the new post-recording save screen — a quick
    // "how did it feel" mood tag and an optional photo. All nullable: manual log entries,
    // non-GPS activities, and every row created before this migration simply have null here and
    // fall back to the plain numeric display.
    await db.execAsync(`
      ALTER TABLE cardio_logs ADD COLUMN route_points TEXT;
      ALTER TABLE cardio_logs ADD COLUMN mood TEXT;
      ALTER TABLE cardio_logs ADD COLUMN photo_uri TEXT;
    `);

    currentDbVersion = 48;
    await db.execAsync(`PRAGMA user_version = 48`);
  }

  if (currentDbVersion === 48) {
    // Opt-in fingerprint/Face ID unlock alongside the existing PIN — purely local (device
    // biometrics don't sync), defaults off so nothing changes for anyone until they explicitly
    // enable it from Settings.
    await db.execAsync(`ALTER TABLE user_profile ADD COLUMN biometric_enabled INTEGER NOT NULL DEFAULT 0`);

    currentDbVersion = 49;
    await db.execAsync(`PRAGMA user_version = 49`);
  }

  if (currentDbVersion === 49) {
    // One row per day of the Life Scoreboard's computed scores — a trend cache derived entirely
    // from data that's already synced elsewhere, not a new source of truth. Powers the scoreboard
    // screen's per-area sparkline/trend without needing a server round-trip. Joined the sync
    // pipeline in the v66 migration below (see its comment) — sync_id/updated_at added there.
    await db.execAsync(`
      CREATE TABLE life_score_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        physical INTEGER NOT NULL,
        mental INTEGER NOT NULL,
        spiritual INTEGER NOT NULL,
        financial INTEGER NOT NULL,
        relationship INTEGER NOT NULL,
        overall INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Weekly nudge to check the scoreboard — off by default, same pattern as time_format.
    await db.execAsync("ALTER TABLE app_settings ADD COLUMN scoreboard_weekly_reminder INTEGER NOT NULL DEFAULT 0");

    currentDbVersion = 50;
    await db.execAsync(`PRAGMA user_version = 50`);
  }

  if (currentDbVersion === 50) {
    // routine_progress/routine_day_logs join the sync pipeline (modules/workout/useRoutineProgress.ts)
    // now that a Start Program / mark-day-complete UI actually writes to them — both tables and
    // their sync_id columns already existed, scaffolded well before that UI did.
    await db.execAsync(`
      CREATE INDEX idx_routine_progress_sync_id ON routine_progress(sync_id);
      CREATE INDEX idx_routine_day_logs_sync_id ON routine_day_logs(sync_id);
    `);

    currentDbVersion = 51;
    await db.execAsync(`PRAGMA user_version = 51`);
  }

  if (currentDbVersion === 51) {
    // Both purely local "have I shown/seen this yet" markers, same single-row app_settings
    // pattern as scoreboard_weekly_reminder above — nullable with no default since "never shown
    // yet" is the natural starting state, not a value that needs its own sentinel.
    await db.execAsync(`
      ALTER TABLE app_settings ADD COLUMN last_weekly_recap_shown_at TEXT;
      ALTER TABLE app_settings ADD COLUMN last_seen_changelog_version TEXT;
    `);

    currentDbVersion = 52;
    await db.execAsync(`PRAGMA user_version = 52`);
  }

  if (currentDbVersion === 52) {
    // Cumulative elevation gain for a GPS-recorded session (running/walking/hiking/cycling) —
    // computed client-side from route altitude deltas (see modules/cardio/locationTracking.ts)
    // and persisted alongside distance/duration. Nullable: manual entries, non-GPS activities
    // (yoga/sports/swimming), and every row logged before this column existed simply have no
    // elevation figure to show.
    await db.execAsync('ALTER TABLE cardio_logs ADD COLUMN elevation_gain_m INTEGER');

    currentDbVersion = 53;
    await db.execAsync(`PRAGMA user_version = 53`);
  }

  if (currentDbVersion === 53) {
    // A dated weight snapshot, separate from user_details.weight_kg (that's a single onboarding
    // value, not a trend) — one row per calendar day (UNIQUE(date), upserted by
    // useBodyMeasurements' addEntry), synced like any other real user data (see
    // modules/sync/syncSchema.ts), unlike the local-only life_score_snapshots trend cache.
    await db.execAsync(`
      CREATE TABLE body_measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        weight_kg REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_body_measurements_sync_id ON body_measurements(sync_id);
    `);

    currentDbVersion = 54;
    await db.execAsync(`PRAGMA user_version = 54`);
  }

  if (currentDbVersion === 54) {
    // Planned payments gain a "this is a subscription" flag (a display/category distinction, not
    // a new system — finance_planned_payments already models a recurring due date via
    // frequency/next_date) and a configurable reminder lead time, replacing the previous
    // hardcoded "notify exactly on next_date" behavior. Both plain ADD COLUMNs, no CHECK
    // constraint, so no table rebuild needed.
    await db.execAsync(`
      ALTER TABLE finance_planned_payments ADD COLUMN is_subscription INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE finance_planned_payments ADD COLUMN remind_days_before INTEGER NOT NULL DEFAULT 0;
    `);

    currentDbVersion = 55;
    await db.execAsync(`PRAGMA user_version = 55`);
  }

  if (currentDbVersion === 55) {
    // One row per day of computed net worth (sum of account balances minus outstanding debts),
    // recorded once per day when the analytics screen's Net Worth section is viewed — same
    // trend-cache pattern as life_score_snapshots (v49 above), derived entirely from
    // finance_accounts/finance_debts, which already sync on their own. Joined the sync pipeline in
    // the v66 migration below (see its comment) — sync_id/updated_at added there.
    await db.execAsync(`
      CREATE TABLE finance_networth_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        net_worth REAL NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    currentDbVersion = 56;
    await db.execAsync(`PRAGMA user_version = 56`);
  }

  if (currentDbVersion === 56) {
    // Lets a timer session started from a task's "Focus on this" button (see app/(tabs)/timer's
    // Pomodoro mode) log its time against that specific task, the same way habit_id already links
    // a session to a habit — nullable, since every session logged before this (and every
    // habit-linked or unlinked one going forward) simply has no task to attach to.
    await db.execAsync('ALTER TABLE timer_logs ADD COLUMN task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL');

    currentDbVersion = 57;
    await db.execAsync(`PRAGMA user_version = 57`);
  }

  if (currentDbVersion === 57) {
    // Per-day mood/energy on cycle_logs (1-5 scale, same convention as journal_checkins' energy/
    // stress/productivity) — nullable, since a logged day may only have flow/symptoms and no
    // mood/energy check-in, same "only set on days something was actually logged" rule as every
    // other column on this table.
    await db.execAsync('ALTER TABLE cycle_logs ADD COLUMN mood INTEGER');
    await db.execAsync('ALTER TABLE cycle_logs ADD COLUMN energy INTEGER');

    currentDbVersion = 58;
    await db.execAsync(`PRAGMA user_version = 58`);
  }

  if (currentDbVersion === 58) {
    // A task can name one other task as blocking it — a single link, not a chain (no cycle
    // detection needed beyond the picker excluding the task itself; see TaskForm.tsx). Nullable,
    // ON DELETE SET NULL like parent_task_id so deleting the blocking task simply unblocks
    // whatever it was blocking rather than cascading.
    await db.execAsync('ALTER TABLE tasks ADD COLUMN blocked_by_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL');

    currentDbVersion = 59;
    await db.execAsync(`PRAGMA user_version = 59`);
  }

  if (currentDbVersion === 59) {
    // Optional free-text grouping label for the Habits list ("Morning routine", "Evening
    // routine", ...) — plain ADD COLUMN, nullable (no group is the default, unchanged rendering).
    // habit_chains is a small new table: a user-defined ordered sequence of existing habits meant
    // to be done back-to-back (see modules/habits/useHabitChains.ts). habit_sync_ids stores the
    // ordered habit *sync_ids* (not local ids) as a JSON string array — the generic foreign-key
    // remap that pushLocalRow/mergeRemoteRecord do (modules/sync/syncEngine.ts) only resolves a
    // single scalar column, not an array of references, so this table sidesteps that entirely by
    // storing ids that are already stable across devices and re-resolving them against the local
    // `habits` table (by sync_id) whenever the chain is read.
    await db.execAsync(`
      ALTER TABLE habits ADD COLUMN routine_group TEXT;

      CREATE TABLE habit_chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        habit_sync_ids TEXT NOT NULL DEFAULT '[]',
        sync_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_habit_chains_sync_id ON habit_chains(sync_id);
    `);

    currentDbVersion = 60;
    await db.execAsync(`PRAGMA user_version = 60`);
  }

  if (currentDbVersion === 60) {
    // Many-to-many task labels — mirrors finance_labels/finance_transaction_labels exactly (see
    // that pair further up this file): a shared label pool plus a join table keyed by the
    // composite (task_id, label_id), so the generic sync engine's `rowid AS id` fallback covers
    // it the same way it already covers finance_transaction_labels (modules/sync/syncEngine.ts).
    await db.execAsync(`
      CREATE TABLE task_labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#8E8E93',
        sync_id TEXT,
        updated_at TEXT
      );

      CREATE TABLE task_task_labels (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        label_id INTEGER NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
        sync_id TEXT,
        updated_at TEXT,
        PRIMARY KEY (task_id, label_id)
      );

      CREATE INDEX idx_task_labels_sync_id ON task_labels(sync_id);
    `);

    currentDbVersion = 61;
    await db.execAsync(`PRAGMA user_version = 61`);
  }

  if (currentDbVersion === 61) {
    // Brick sessions: comboGroupId links 2+ cardio_logs rows together as one displayed session
    // ("Brick: 5km run + 15km bike") — see modules/cardio/pendingSession.ts for how it's carried
    // from one activity's record/save flow into the next leg's. Weather tag is a manual,
    // fixed-picklist self-report (no API) purely for the user's own pattern-spotting — same
    // unconstrained ADD COLUMN shape as sport_name/intensity above.
    await db.execAsync(`
      ALTER TABLE cardio_logs ADD COLUMN combo_group_id TEXT;
      ALTER TABLE cardio_logs ADD COLUMN weather TEXT;
      CREATE INDEX idx_cardio_logs_combo_group_id ON cardio_logs(combo_group_id);
    `);

    // Favorite/saved routes, for a "vs your best on this route" comparison (see
    // modules/cardio/favoriteRoutes.ts). Matching is a deliberately coarse heuristic — same start
    // point within ~100m and a similar total distance — not exact point-for-point route matching,
    // so only the start coordinate and the distance are stored; "best time on this route" is
    // computed on the fly from cardio_logs whenever needed rather than cached here, so it can
    // never drift stale.
    await db.execAsync(`
      CREATE TABLE cardio_favorite_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity TEXT NOT NULL,
        label TEXT NOT NULL,
        start_lat REAL NOT NULL,
        start_lng REAL NOT NULL,
        distance_km REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_cardio_favorite_routes_sync_id ON cardio_favorite_routes(sync_id);
    `);

    currentDbVersion = 62;
    await db.execAsync(`PRAGMA user_version = 62`);
  }

  if (currentDbVersion === 62) {
    // Care Suggestion opt-in: off by default, deliberately separate from the existing
    // Accountability Partner "Cycle & mood insights" sharing toggle (partnerships.sharing.cycle,
    // which already shares the exact cycle phase + mood key once a partnership exists). This
    // column instead gates a much coarser, binary derived signal (see
    // modules/partner/useAccountabilityInsights.ts's cyclePhaseHint/moodTrendHint) that's synced
    // to the partner ONLY when this is on — never raw flow/symptom/mood log data.
    await db.execAsync(`
      ALTER TABLE cycle_preferences ADD COLUMN shares_cycle_insights_with_partner INTEGER NOT NULL DEFAULT 0;
    `);

    currentDbVersion = 63;
    await db.execAsync(`PRAGMA user_version = 63`);
  }

  if (currentDbVersion === 63) {
    // Relationships (see modules/relationships): the people you've added (family/partner/friend/
    // other) plus a check-in log against each — feeds the Life Scoreboard's Relationship score
    // (modules/scoreboard/useLifeScore.ts), replacing the fixed-50 placeholder that stood in for
    // the removed Accountability Partner signal. `person_id` is a plain local integer FK like
    // finance_transaction_labels' `label_id` — the sync engine remaps it via sync_id on pull, see
    // modules/sync/syncSchema.ts's `foreignKeys` entry for this table.
    await db.execAsync(`
      CREATE TABLE relationship_people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        relation TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_relationship_people_sync_id ON relationship_people(sync_id);

      CREATE TABLE relationship_checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_id TEXT
      );
      CREATE INDEX idx_relationship_checkins_person_id ON relationship_checkins(person_id);
      CREATE INDEX idx_relationship_checkins_sync_id ON relationship_checkins(sync_id);
    `);

    currentDbVersion = 64;
    await db.execAsync(`PRAGMA user_version = 64`);
  }

  if (currentDbVersion === 64) {
    // A check-in now records HOW you connected and for how long, not just that you did — see
    // modules/relationships/types.ts's CheckinMode. Both nullable: existing rows from before this
    // migration simply have neither, same as any other backfill-less column addition in this file.
    await db.execAsync(`
      ALTER TABLE relationship_checkins ADD COLUMN mode TEXT;
      ALTER TABLE relationship_checkins ADD COLUMN duration_minutes INTEGER;
    `);

    currentDbVersion = 65;
    await db.execAsync(`PRAGMA user_version = 65`);
  }

  if (currentDbVersion === 65) {
    // life_score_snapshots/finance_networth_snapshots join the sync pipeline — previously
    // deliberately local-only (see their CREATE TABLE comments above) since they're derived caches
    // of scores/figures already computed from other tables that sync on their own. Syncing them
    // too means the Scoreboard/Net Worth trend charts show the same history across every device
    // instead of only the one that happened to compute each day's snapshot. `updated_at` mirrors
    // `created_at` at insert time (see useLifeScoreHistory.ts/useNetWorthHistory.ts's
    // recordTodaySnapshot: these rows are insert-once and never updated afterward, so the two
    // timestamps never actually diverge) — every synced table needs its own `updated_at` for the
    // sync engine's last-write-wins merge, it can't reuse `created_at` under a different name.
    await db.execAsync(`
      ALTER TABLE life_score_snapshots ADD COLUMN updated_at TEXT;
      ALTER TABLE life_score_snapshots ADD COLUMN sync_id TEXT;
      CREATE INDEX idx_life_score_snapshots_sync_id ON life_score_snapshots(sync_id);

      ALTER TABLE finance_networth_snapshots ADD COLUMN updated_at TEXT;
      ALTER TABLE finance_networth_snapshots ADD COLUMN sync_id TEXT;
      CREATE INDEX idx_finance_networth_snapshots_sync_id ON finance_networth_snapshots(sync_id);
    `);

    currentDbVersion = 66;
    await db.execAsync(`PRAGMA user_version = 66`);
  }

  if (currentDbVersion === 66) {
    // Lets a just-finished timer session be attached to a task/checklist item after the fact (not
    // just a session started FROM that task's "Focus on this" button, which already sets task_id
    // at insert time via v57 above) plus a free-text note about what was actually worked on — see
    // the "Add details" prompt on the Timer screen (app/(tabs)/timer/index.tsx) shown once a
    // stopwatch/countdown/Pomodoro session is saved. Nullable/backfill-less like every other
    // optional column added after the fact in this file.
    await db.execAsync('ALTER TABLE timer_logs ADD COLUMN note TEXT');

    currentDbVersion = 67;
    await db.execAsync(`PRAGMA user_version = 67`);
  }

  // Future modules land here as `if (currentDbVersion === 67) { ... currentDbVersion = 68; }`
  // — each module owns its own tables; the Analytics Dashboard only ever adds
  // read-only queries against these, never its own tables.

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
